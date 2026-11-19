"""spot-check: re-fetch a seeded sample of release cells from the upstream API.

Only World Bank cells (WDI/WGI/LPI) can be re-fetched; other sources are
manual drops with no per-cell API. The fetcher is injectable and tests use
recorded responses only.
"""

from __future__ import annotations

import json
import math
import random
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import SourceUnavailableError, fetch_bytes
from imsatlas_etl.connectors.worldbank import API_ROOT, api_indicator_code, parse_page
from imsatlas_etl.pipeline.io_paths import public_release_dir, status_root
from imsatlas_etl.pipeline.provenance import PROVENANCE_PARQUET

WB_SOURCES = frozenset({"worldbank_wdi", "worldbank_wgi", "worldbank_lpi"})
SPOT_CHECK_NAME = "spot_check.json"
REL_TOL = 1e-9
RATE_LIMIT_S = 0.5

# url -> response body; raises SourceUnavailableError when unreachable
SpotFetcher = Callable[[str], bytes]


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def spot_check_path(*, root: Path | None = None) -> Path:
    return status_root(root) / SPOT_CHECK_NAME


def cell_url(iso3: str, code: str, year: int) -> str:
    return (
        f"{API_ROOT}/country/{iso3}/indicator/{api_indicator_code(code)}"
        f"?format=json&date={year}"
    )


def fixture_response_name(iso3: str, code: str, year: int) -> str:
    return f"{iso3}_{year}_{code}.json"


def fixture_fetcher(directory: Path, samples: list[dict[str, Any]]) -> SpotFetcher:
    """Serve recorded JSON bodies keyed by the cell URL; missing -> unreachable."""
    by_url = {
        str(s["url"]): directory
        / fixture_response_name(s["iso3"], s["upstream_code"], s["year"])
        for s in samples
    }

    def fetch(url: str) -> bytes:
        path = by_url.get(url)
        if path is None or not path.is_file():
            raise SourceUnavailableError(f"no recorded response for {url}")
        return path.read_bytes()

    return fetch


def live_fetcher(*, sleep: Callable[[float], None] = time.sleep) -> SpotFetcher:
    def fetch(url: str) -> bytes:
        sleep(RATE_LIMIT_S)
        return fetch_bytes(url, timeout=45.0)[0]

    return fetch


def checkable_cells(provenance: pd.DataFrame) -> pd.DataFrame:
    """Country cells from a World Bank source with an upstream code, in key order."""
    if provenance.empty:
        return provenance
    mask = (
        provenance["source_id"].isin(WB_SOURCES)
        & provenance["upstream_code"].notna()
        & provenance["iso3"].notna()
        & provenance["value"].notna()
    )
    keys = ["variable_id", "iso3", "year"]
    return provenance[mask].sort_values(keys).reset_index(drop=True)


def sample_cells(cells: pd.DataFrame, n: int, seed: int) -> pd.DataFrame:
    """Seeded simple random sample without replacement (deterministic)."""
    if n < 0:
        raise ValueError("n must be >= 0")
    if cells.empty or n == 0:
        return cells.iloc[0:0]
    rng = random.Random(seed)
    picks = sorted(rng.sample(range(len(cells)), min(n, len(cells))))
    return cells.iloc[picks].reset_index(drop=True)


def upstream_value(body: bytes, year: int) -> float | None:
    """Value for ``year`` in a WB v2 response; ``None`` when absent or null."""
    _meta, rows = parse_page(body, label="spot-check")
    for row in rows:
        if str(row.get("date")) == str(year):
            value = row.get("value")
            return None if value is None else float(value)
    return None


def compare_value(release_value: float, upstream: float | None) -> bool:
    if upstream is None:
        return False
    return math.isclose(release_value, upstream, rel_tol=REL_TOL, abs_tol=0.0)


def check_sample(sample: dict[str, Any], fetch: SpotFetcher) -> dict[str, Any]:
    """Classify one sample as match / mismatch / unreachable."""
    result = dict(sample)
    try:
        body = fetch(str(sample["url"]))
        upstream = upstream_value(body, int(sample["year"]))
    except SourceUnavailableError as exc:
        return {**result, "status": "unreachable", "detail": str(exc)}
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        return {**result, "status": "unreachable", "detail": f"bad response: {exc}"}
    result["upstream_value"] = upstream
    ok = compare_value(float(sample["release_value"]), upstream)
    return {**result, "status": "match" if ok else "mismatch"}


def _count(samples: list[dict[str, Any]], status: str) -> int:
    return sum(1 for s in samples if s.get("status") == status)


def build_report(
    *,
    seed: int,
    n: int,
    release: str | None,
    n_population: int,
    n_checkable: int,
    samples: list[dict[str, Any]],
    note: str | None = None,
) -> dict[str, Any]:
    return {
        "generated_at": _now_iso(),
        "seed": seed,
        "n": n,
        "n_sampled": len(samples),
        "matches": _count(samples, "match"),
        "mismatches": _count(samples, "mismatch"),
        "unreachable": _count(samples, "unreachable"),
        "release": release,
        "n_cells_population": n_population,
        "n_cells_checkable": n_checkable,
        "note": note,
        "samples": samples,
    }


def current_release_dir(*, root: Path | None = None) -> Path | None:
    parent = public_release_dir(root=root)
    pointer = parent / "CURRENT"
    if not pointer.is_file():
        return None
    name = pointer.read_text(encoding="utf-8").strip()
    return parent / name if name else None


def run_spot_check(
    *,
    n: int = 200,
    seed: int = 1,
    root: Path | None = None,
    release_dir: Path | None = None,
    fixture_responses: Path | None = None,
    fetch: SpotFetcher | None = None,
    write: bool = True,
) -> dict[str, Any]:
    """
    Sample ``n`` cells from the public release provenance and re-fetch them.

    No provenance, or zero cells -> an empty report (``n_sampled == 0``).
    Network is used only when neither ``fixture_responses`` nor ``fetch`` is set.
    """
    base = release_dir or current_release_dir(root=root)
    prov_path = base / PROVENANCE_PARQUET if base else None
    note: str | None = None
    provenance = pd.DataFrame()
    if prov_path is None or not prov_path.is_file():
        note = "no public release provenance found; nothing to sample"
    else:
        provenance = pd.read_parquet(prov_path)
        if provenance.empty:
            note = "release has 0 cells; nothing to sample"
    cells = checkable_cells(provenance)
    if note is None and cells.empty:
        note = "release has no World Bank cells to re-fetch"
    picked = sample_cells(cells, n, seed)
    samples = [
        {
            "variable_id": str(r.variable_id),
            "source_id": str(r.source_id),
            "iso3": str(r.iso3),
            "year": int(r.year),
            "upstream_code": str(r.upstream_code),
            "release_value": float(r.value),
            "url": cell_url(str(r.iso3), str(r.upstream_code), int(r.year)),
        }
        for r in picked.itertuples(index=False)
    ]
    if samples:
        getter = fetch or (
            fixture_fetcher(fixture_responses, samples)
            if fixture_responses is not None
            else live_fetcher()
        )
        samples = [check_sample(s, getter) for s in samples]
    report = build_report(
        seed=seed,
        n=n,
        release=base.name if base else None,
        n_population=int(len(provenance)),
        n_checkable=int(len(cells)),
        samples=samples,
        note=note,
    )
    if write:
        out = spot_check_path(root=root)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    return report
