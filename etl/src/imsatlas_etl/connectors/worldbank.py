"""World Bank WDI/WGI/LPI connectors (fixture + live probe)."""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import (
    Sleeper,
    SourceUnavailableError,
    fetch_bytes,
    write_artifact,
)
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir
from imsatlas_etl.wb_indicators import world_bank_codes_for_source

API_ROOT = "https://api.worldbank.org/v2"
PER_PAGE = 20000
DEFAULT_RATE_LIMIT_S = 0.5
MAX_PAGES = 200  # hard stop against a malformed `pages` field

Fetcher = Callable[[str], tuple[bytes, dict[str, str]]]

# Representative codes for version probes (one per source family).
PROBE_CODES = {
    "worldbank_wdi": "NY.GDP.PCAP.PP.KD",
    # Catalog still uses archived WDI-archive ids (CC.EST, …). The live
    # country/indicator endpoint only serves the GOV_WGI_* series (source 3).
    # Observed 2026-11-19 against api.worldbank.org — MANUAL CHECK vs catalog.
    "worldbank_wgi": "GOV_WGI_CC.EST",
    "worldbank_lpi": "LP.LPI.OVRL.XQ",
}

# Catalog code → live API code. Values written to indicators.csv keep the
# catalog id so curated transforms stay stable; only the HTTP request remaps.
WGI_API_ALIASES: dict[str, str] = {
    "CC.EST": "GOV_WGI_CC.EST",
    "GE.EST": "GOV_WGI_GE.EST",
    "PV.EST": "GOV_WGI_PV.EST",
    "RL.EST": "GOV_WGI_RL.EST",
    "RQ.EST": "GOV_WGI_RQ.EST",
    "VA.EST": "GOV_WGI_VA.EST",
}


def api_indicator_code(catalog_code: str) -> str:
    return WGI_API_ALIASES.get(catalog_code, catalog_code)


def indicator_page_url(code: str, page: int = 1) -> str:
    return (
        f"{API_ROOT}/country/all/indicator/{code}"
        f"?format=json&per_page={PER_PAGE}&page={page}"
    )


def countries_page_url(page: int = 1) -> str:
    return f"{API_ROOT}/country?format=json&per_page=400&page={page}"


def indicator_url(code: str) -> str:
    return (
        "https://api.worldbank.org/v2/country/all/indicator/"
        f"{code}?format=json&per_page=1"
    )


def probe_version(source_id: str) -> dict[str, Any]:
    code = api_indicator_code(PROBE_CODES[source_id])
    body, _headers = fetch_bytes(indicator_url(code), timeout=45.0)
    payload = json.loads(body.decode("utf-8"))
    lastupdated = None
    if isinstance(payload, list) and len(payload) >= 1 and isinstance(payload[0], dict):
        lastupdated = payload[0].get("lastupdated")
    return {
        "upstream_version": str(lastupdated or "wb-unknown"),
        "upstream_changed_at": lastupdated,
        "probe_code": code,
    }


def extract_from_fixture(
    source_id: str,
    version: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    src = fixture_root / source_id
    csv_path = src / "indicators.csv"
    if not csv_path.is_file():
        raise FileNotFoundError(csv_path)
    dest_dir = raw_source_dir(source_id, version, root=root)
    dest = dest_dir / "indicators.csv"
    if dest.is_file() and not force:
        return {
            "source": source_id,
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    body = csv_path.read_bytes()
    meta = write_artifact(
        dest,
        body,
        url=f"fixture://{source_id}/indicators.csv",
        headers={},
        extra_meta={"mode": "fixture", "version": version},
    )
    return {
        "source": source_id,
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }


def load_raw_indicators(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"iso3", "year", "indicator", "value"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing columns {sorted(missing)}")
    df["year"] = df["year"].astype(int)
    return df


def codes_for_source(source_id: str) -> list[str]:
    """Indicator codes to pull: catalog variables for the source, else the probe."""
    codes = world_bank_codes_for_source(source_id)
    return codes or [PROBE_CODES[source_id]]


def parse_page(body: bytes, *, label: str) -> tuple[dict[str, Any], list[Any]]:
    """Split a WB v2 JSON page into (paging meta, rows); raise on API errors."""
    payload = json.loads(body.decode("utf-8"))
    if not isinstance(payload, list) or not payload or not isinstance(payload[0], dict):
        raise ValueError(f"{label}: unexpected World Bank payload shape")
    meta = payload[0]
    if "message" in meta:
        raise ValueError(f"{label}: World Bank API error {meta['message']!r}")
    rows = payload[1] if len(payload) > 1 and payload[1] is not None else []
    if not isinstance(rows, list):
        raise ValueError(f"{label}: expected a list of rows")
    return meta, rows


def _fetch_all_pages(
    url_for: Callable[[int], str],
    *,
    label: str,
    fetch: Fetcher,
    sleep: Sleeper,
    rate_limit_s: float,
    on_page: Callable[[int, str, bytes, dict[str, str]], None] | None = None,
) -> tuple[dict[str, Any], list[Any]]:
    """Follow ``pages`` in the meta block; sleep between requests."""
    first_meta: dict[str, Any] = {}
    rows: list[Any] = []
    page, pages = 1, 1
    while page <= pages:
        if page > 1:
            sleep(rate_limit_s)
        url = url_for(page)
        body, headers = fetch(url)
        if on_page is not None:
            on_page(page, url, body, headers)
        meta, page_rows = parse_page(body, label=f"{label} p{page}")
        if page == 1:
            first_meta = meta
            pages = int(meta.get("pages") or 1)
            if pages > MAX_PAGES:
                raise ValueError(f"{label}: implausible page count {pages}")
        rows.extend(page_rows)
        page += 1
    return first_meta, rows


def country_filter(
    fetch: Fetcher,
    *,
    sleep: Sleeper,
    rate_limit_s: float,
) -> tuple[set[str], set[str]]:
    """Return (country iso3 set, aggregate iso3 set) from /v2/country."""
    _meta, rows = _fetch_all_pages(
        countries_page_url,
        label="countries",
        fetch=fetch,
        sleep=sleep,
        rate_limit_s=rate_limit_s,
    )
    countries: set[str] = set()
    aggregates: set[str] = set()
    for row in rows:
        iso3 = str(row.get("id") or "").strip()
        if len(iso3) != 3:
            continue
        region = row.get("region") or {}
        if str(region.get("id")) == "NA":
            aggregates.add(iso3)
        else:
            countries.add(iso3)
    if not countries:
        raise ValueError("countries: World Bank country list contained no countries")
    return countries, aggregates


def tidy_indicator_rows(
    code: str,
    rows: list[Any],
    *,
    countries: set[str],
    aggregates: set[str],
    min_year: int = MIN_YEAR,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Convert WB rows to (iso3, year, indicator, value); count every discard."""
    counts = {
        "n_api_rows": len(rows),
        "n_kept": 0,
        "n_null_value": 0,
        "n_aggregate": 0,
        "n_unknown_iso3": 0,
        "n_non_annual": 0,
        "n_before_min_year": 0,
    }
    kept: list[dict[str, Any]] = []
    for row in rows:
        iso3 = str(row.get("countryiso3code") or "").strip()
        if iso3 in aggregates:
            counts["n_aggregate"] += 1
            continue
        if iso3 not in countries:
            counts["n_unknown_iso3"] += 1
            continue
        date = str(row.get("date") or "").strip()
        if not date.isdigit():
            counts["n_non_annual"] += 1
            continue
        year = int(date)
        if year < min_year:
            counts["n_before_min_year"] += 1
            continue
        value = row.get("value")
        if value is None:
            counts["n_null_value"] += 1
            continue
        kept.append(
            {"iso3": iso3, "year": year, "indicator": code, "value": float(value)},
        )
    counts["n_kept"] = len(kept)
    frame = pd.DataFrame.from_records(
        kept,
        columns=["iso3", "year", "indicator", "value"],
    )
    return frame, counts


def extract_live(
    source_id: str,
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
    codes: list[str] | None = None,
    fetch: Fetcher | None = None,
    sleep: Sleeper = time.sleep,
    rate_limit_s: float = DEFAULT_RATE_LIMIT_S,
) -> dict[str, Any]:
    """Pull every catalog indicator for ``source_id`` from the WB v2 API.

    Writes raw pages under ``pages/<code>_pN.json`` (+ ``.meta.json``),
    ``indicators.csv`` for the contract loader, and ``summary.json`` with the
    per-indicator ``lastupdated`` and every discard count.
    """
    dest_dir = raw_source_dir(source_id, version, root=root)
    csv_path = dest_dir / "indicators.csv"
    if csv_path.is_file() and not force:
        return {
            "source": source_id,
            "version": version,
            "path": str(csv_path),
            "skipped": True,
        }
    getter: Fetcher = fetch or (lambda url: fetch_bytes(url, timeout=90.0))
    selected = list(codes) if codes else codes_for_source(source_id)

    countries, aggregates = country_filter(
        getter,
        sleep=sleep,
        rate_limit_s=rate_limit_s,
    )
    frames: list[pd.DataFrame] = []
    per_code: dict[str, dict[str, Any]] = {}
    skipped_codes: dict[str, str] = {}
    for code in selected:

        def _save(
            page: int,
            url: str,
            body: bytes,
            headers: dict[str, str],
            _code: str = code,
        ) -> None:
            write_artifact(
                dest_dir / "pages" / f"{_code}_p{page}.json",
                body,
                url=url,
                headers=headers,
                extra_meta={"mode": "live", "version": version, "indicator": _code},
            )

        api_code = api_indicator_code(code)
        label = f"{code}→{api_code}" if api_code != code else code
        try:
            meta, rows = _fetch_all_pages(
                lambda page, _api=api_code: indicator_page_url(_api, page),
                label=label,
                fetch=getter,
                sleep=sleep,
                rate_limit_s=rate_limit_s,
                on_page=_save,
            )
        except ValueError as exc:
            # Archived / deleted series (e.g. Doing Business IC.IMP.CSBC.CD) must
            # not abort the whole source extract when other indicators succeed.
            skipped_codes[code] = str(exc)
            per_code[code] = {
                "catalog_code": code,
                "api_code": api_code,
                "status": "skipped",
                "reason": str(exc),
                "n_kept": 0,
            }
            continue
        sleep(rate_limit_s)
        frame, counts = tidy_indicator_rows(
            code,
            rows,
            countries=countries,
            aggregates=aggregates,
        )
        frames.append(frame)
        per_code[code] = {
            "catalog_code": code,
            "api_code": api_code,
            "lastupdated": meta.get("lastupdated"),
            "pages": int(meta.get("pages") or 1),
            "total": meta.get("total"),
            "status": "ok",
            **counts,
        }

    table = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if table.empty:
        raise SourceUnavailableError(
            f"{source_id}: World Bank API returned no usable rows for {selected}",
        )
    table = table.sort_values(["indicator", "iso3", "year"]).reset_index(drop=True)
    body = table.to_csv(index=False).encode("utf-8")
    updated = sorted(
        str(v["lastupdated"]) for v in per_code.values() if v["lastupdated"]
    )
    upstream_version = updated[-1] if updated else "wb-unknown"
    summary: dict[str, Any] = {
        "source": source_id,
        "version": version,
        "mode": "live",
        "indicators": per_code,
        "skipped_codes": skipped_codes,
        "rows": int(len(table)),
        "countries": int(table["iso3"].nunique()),
        "year_min": int(table["year"].min()),
        "year_max": int(table["year"].max()),
        "upstream_version": upstream_version,
        "aggregate_codes_excluded": sorted(aggregates),
        "min_year_filter": MIN_YEAR,
    }
    (dest_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    meta_out = write_artifact(
        csv_path,
        body,
        url=f"{API_ROOT}/country/all/indicator/{{code}}",
        headers={},
        extra_meta={
            "mode": "live",
            "version": version,
            "indicators": selected,
            "upstream_version": upstream_version,
        },
    )
    return {
        "source": source_id,
        "version": version,
        "path": str(csv_path),
        "skipped": False,
        "meta": meta_out,
        "rows": summary["rows"],
        "countries": summary["countries"],
        "years": [summary["year_min"], summary["year_max"]],
        "upstream_version": upstream_version,
        "lastupdated": {k: v["lastupdated"] for k, v in per_code.items()},
    }
