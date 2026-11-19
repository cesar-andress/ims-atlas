"""WITS/TRAINS tariff connector (fixture + local-only live SDMX TRN loop).

Live pattern (from the ims-backtest ``data/manual/wits/README.md``)::

    {base}/reporter/{rep}/partner/{origin}/product/all/year/{y}/datatype/{dtype}

* EU members use reporter ``918``; GBR uses ``918`` for years <= 2020.
* ``reported`` is fetched first; when a triple has non-ad-valorem lines
  (``NBR_NA_LINES`` > 0) the ``aveestimated`` series replaces those lines.
* No MFN fallback and no LOCF: a (destination, origin, year) without data is a
  gap, listed in ``summary.json`` and left absent from ``tariffs.csv``.

WITS terms are unverified (login-gated), so this source stays local_only/BYOD:
raw files are never released. See ``catalog/sources.yaml`` and the gate.
"""

from __future__ import annotations

import json
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
import yaml

from imsatlas_etl.connectors.http import (
    HttpResponse,
    Sleeper,
    SourceUnavailableError,
    fetch_response,
    write_artifact,
)
from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.io_paths import raw_source_dir

TRN_BASE = "https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN"
EU_REPORTER = "918"
GBR_EU_LAST_YEAR = 2020
DEFAULT_RATE_LIMIT_S = 0.5

EU27_ISO3: frozenset[str] = frozenset(
    {
        "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA",
        "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD",
        "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE",
    },
)  # fmt: skip

StatusFetcher = Callable[[str], HttpResponse]

LINE_COLUMNS = ["product_code", "year", "ahs", "nbr_na_lines"]


@dataclass(frozen=True)
class WitsConfig:
    """Scope of a live TRN pull; supplied by the human in config/wits_trains.json."""

    version: str
    reporters: tuple[str, ...]
    partners: tuple[str, ...]
    year_start: int
    year_end: int
    hs_chapters: tuple[str, ...]
    base_url: str = TRN_BASE


def config_path(*, root: Path | None = None) -> Path:
    return (root or repo_root()) / "config" / "wits_trains.json"


def load_config(*, root: Path | None = None) -> WitsConfig:
    path = config_path(root=root)
    if not path.is_file():
        raise SourceUnavailableError(
            "wits_trains: missing config/wits_trains.json "
            "(see data/manual/wits_trains/README.md)",
        )
    raw = json.loads(path.read_text(encoding="utf-8"))
    years = raw["years"]
    return WitsConfig(
        version=str(raw["version"]),
        reporters=tuple(str(c).upper() for c in raw["reporters"]),
        partners=tuple(str(c).upper() for c in raw["partners"]),
        year_start=int(years[0]),
        year_end=int(years[1]),
        hs_chapters=tuple(str(c).zfill(2) for c in raw["hs_chapters"]),
        base_url=str(raw.get("base_url") or TRN_BASE).rstrip("/"),
    )


def load_iso3_numeric(*, root: Path | None = None) -> dict[str, str]:
    path = (root or repo_root()) / "config" / "iso3_numeric.yaml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"{path}: expected a mapping")
    return {str(k).upper(): str(v).zfill(3) for k, v in raw.items()}


def reporter_code(iso3: str, year: int, numeric: dict[str, str]) -> str:
    """WITS reporter: EU27 and GBR (<= 2020) -> 918, else the ISO numeric code."""
    code = iso3.upper()
    if code in EU27_ISO3 or (code == "GBR" and year <= GBR_EU_LAST_YEAR):
        return EU_REPORTER
    if code not in numeric:
        raise KeyError(f"no ISO numeric code for reporter {code!r}")
    return numeric[code]


def destinations_for(
    rep_code: str,
    year: int,
    reporters: tuple[str, ...],
    numeric: dict[str, str],
) -> list[str]:
    """Configured destinations whose reporter code in ``year`` is ``rep_code``."""
    return sorted(
        iso3 for iso3 in reporters if reporter_code(iso3, year, numeric) == rep_code
    )


def trn_url(
    reporter: str,
    partner: str,
    year: int,
    datatype: str,
    *,
    base_url: str = TRN_BASE,
) -> str:
    return (
        f"{base_url.rstrip('/')}/reporter/{reporter}/partner/{partner}/product/all/"
        f"year/{int(year)}/datatype/{datatype}"
    )


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_trn_xml(body: bytes) -> pd.DataFrame:
    """Parse a StructureSpecific TRN message: one row per product/year Obs."""
    if not body.strip():
        return pd.DataFrame(columns=LINE_COLUMNS)
    root = ET.fromstring(body.decode("utf-8", errors="replace"))  # noqa: S314
    rows: list[dict[str, Any]] = []
    for series in root.iter():
        if _local(series.tag) != "Series":
            continue
        sattrs = {_local(k): v for k, v in series.attrib.items()}
        product = str(sattrs.get("PRODUCTCODE", "")).strip()
        if not product:
            continue
        for obs in series:
            if _local(obs.tag) != "Obs":
                continue
            oattrs = {_local(k): v for k, v in obs.attrib.items()}
            period, value = oattrs.get("TIME_PERIOD"), oattrs.get("OBS_VALUE")
            if period is None or value is None:
                continue
            try:
                rows.append(
                    {
                        "product_code": product,
                        "year": int(str(period)[:4]),
                        "ahs": float(value),
                        "nbr_na_lines": int(float(oattrs.get("NBR_NA_LINES") or 0)),
                    },
                )
            except ValueError:
                continue
    return pd.DataFrame.from_records(rows, columns=LINE_COLUMNS)


def merge_reported_aveestimated(
    reported: pd.DataFrame,
    ave: pd.DataFrame,
) -> tuple[pd.DataFrame, int]:
    """Use aveestimated AHS on lines with NA rates; return (frame, n NA w/o ave)."""
    out = reported.copy()
    out["ahs_source"] = "reported"
    has_na = out["nbr_na_lines"] > 0
    if ave.empty:
        return out, int(has_na.sum())
    ave_s = (
        ave.drop_duplicates(["product_code", "year"])
        .set_index(["product_code", "year"])["ahs"]
        .rename("ave_ahs")
    )
    out = out.join(ave_s, on=["product_code", "year"])
    use = has_na & out["ave_ahs"].notna()
    out.loc[use, "ahs"] = out.loc[use, "ave_ahs"]
    out.loc[use, "ahs_source"] = "aveestimated"
    return out.drop(columns=["ave_ahs"]), int((has_na & ~use).sum())


def filter_hs6(
    lines: pd.DataFrame,
    chapters: tuple[str, ...],
) -> tuple[pd.DataFrame, int]:
    """Keep 6-digit codes in the configured chapters; count other-length codes."""
    if lines.empty:
        return lines, 0
    code = lines["product_code"].astype(str).str.strip()
    is_hs6 = code.str.fullmatch(r"\d{6}")
    in_chapter = code.str[:2].isin(set(chapters))
    out = lines[is_hs6 & in_chapter].copy()
    out["product_code"] = code[is_hs6 & in_chapter]
    return out, int((~is_hs6 & in_chapter).sum())


def _http_fetch(url: str, sleep: Sleeper) -> HttpResponse:
    return fetch_response(
        url,
        timeout=90.0,
        attempts=5,
        ok_statuses=frozenset({200, 404}),
        sleep=sleep,
    )


def _cached(path: Path) -> HttpResponse | None:
    meta_path = path.with_suffix(path.suffix + ".meta.json")
    if not (path.is_file() and meta_path.is_file()):
        return None
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    return HttpResponse(int(meta.get("status", 200)), path.read_bytes(), {})


def _get_xml(
    url: str,
    path: Path,
    *,
    fetch: StatusFetcher,
    sleep: Sleeper,
    rate_limit_s: float,
    force: bool,
    stats: dict[str, int],
) -> HttpResponse:
    hit = None if force else _cached(path)
    if hit is not None:
        stats["n_cached"] += 1
        return hit
    sleep(rate_limit_s)
    response = fetch(url)
    stats["n_requests"] += 1
    write_artifact(
        path,
        response.body if response.status == 200 else b"",
        url=url,
        headers=response.headers,
        extra_meta={"mode": "live", "status": response.status},
    )
    return response


def build_tariffs(
    cfg: WitsConfig,
    numeric: dict[str, str],
    *,
    xml_dir: Path,
    fetch: StatusFetcher,
    sleep: Sleeper,
    rate_limit_s: float,
    force: bool,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Run the SDMX TRN loop and return (tariffs table, summary)."""
    partner_code = {o: numeric[o] for o in cfg.partners}
    years = range(cfg.year_start, cfg.year_end + 1)
    stats = {"n_requests": 0, "n_cached": 0}
    flags = {"n_na_without_ave": 0, "n_non_hs6": 0, "n_duplicate_rows": 0}
    rows: list[pd.DataFrame] = []
    observed: set[tuple[str, str, int]] = set()

    def get(rep: str, ptn: str, year: int, dtype: str) -> HttpResponse:
        path = xml_dir / f"trn_r{rep}_p{ptn}_y{year}_{dtype}.xml"
        url = trn_url(rep, ptn, year, dtype, base_url=cfg.base_url)
        return _get_xml(
            url,
            path,
            fetch=fetch,
            sleep=sleep,
            rate_limit_s=rate_limit_s,
            force=force,
            stats=stats,
        )

    for year in years:
        rep_codes = sorted({reporter_code(r, year, numeric) for r in cfg.reporters})
        for rep in rep_codes:
            dests = destinations_for(rep, year, cfg.reporters, numeric)
            for origin in cfg.partners:
                ptn = partner_code[origin]
                resp = get(rep, ptn, year, "reported")
                lines, n_non = filter_hs6(parse_trn_xml(resp.body), cfg.hs_chapters)
                flags["n_non_hs6"] += n_non
                lines = lines[lines["year"] == year]
                if lines.empty:
                    continue
                ave = pd.DataFrame(columns=LINE_COLUMNS)
                if (lines["nbr_na_lines"] > 0).any():
                    ave_resp = get(rep, ptn, year, "aveestimated")
                    ave, _ = filter_hs6(parse_trn_xml(ave_resp.body), cfg.hs_chapters)
                lines, n_miss = merge_reported_aveestimated(lines, ave)
                flags["n_na_without_ave"] += n_miss
                for dest in dests:
                    observed.add((dest, origin, year))
                    rows.append(
                        pd.DataFrame(
                            {
                                "year": year,
                                "origin": origin,
                                "destination": dest,
                                "hs6": lines["product_code"].to_numpy(),
                                "ahs": lines["ahs"].to_numpy(),
                            },
                        ),
                    )
    table = (
        pd.concat(rows, ignore_index=True)
        if rows
        else pd.DataFrame(
            columns=["year", "origin", "destination", "hs6", "ahs"],
        )
    )
    key = ["year", "origin", "destination", "hs6"]
    flags["n_duplicate_rows"] = int(table.duplicated(key).sum())
    table = (
        table.groupby(key, as_index=False)["ahs"].mean().sort_values(key)
        if not table.empty
        else table
    ).reset_index(drop=True)
    gaps = [
        {"destination": d, "origin": o, "year": y}
        for y in years
        for o in cfg.partners
        for d in sorted(cfg.reporters)
        if (d, o, y) not in observed
    ]
    summary: dict[str, Any] = {
        "source": "wits_trains",
        "version": cfg.version,
        "mode": "live",
        "distribution": "local_only",
        "eu_reporter": EU_REPORTER,
        "gbr_eu_until": GBR_EU_LAST_YEAR,
        "locf_applied": False,
        "mfn_fallback_applied": False,
        "gaps": gaps,
        "n_gaps": len(gaps),
        "flags": flags,
        **stats,
        "rows": int(len(table)),
    }
    return table, summary


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
    config: WitsConfig | None = None,
    fetch: StatusFetcher | None = None,
    sleep: Sleeper = time.sleep,
    rate_limit_s: float = DEFAULT_RATE_LIMIT_S,
) -> dict[str, Any]:
    """Network (local only): run the TRN loop and write ``tariffs.csv``."""
    dest_dir = raw_source_dir("wits_trains", version, root=root)
    dest = dest_dir / "tariffs.csv"
    if dest.is_file() and not force:
        return {
            "source": "wits_trains",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    cfg = config or load_config(root=root)
    numeric = load_iso3_numeric(root=root)
    getter: StatusFetcher = fetch or (lambda url: _http_fetch(url, sleep))
    table, summary = build_tariffs(
        cfg,
        numeric,
        xml_dir=dest_dir / "xml",
        fetch=getter,
        sleep=sleep,
        rate_limit_s=rate_limit_s,
        force=force,
    )
    if table.empty:
        raise SourceUnavailableError("wits_trains: TRN returned no usable tariff rows")
    (dest_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    meta = write_artifact(
        dest,
        table.to_csv(index=False).encode("utf-8"),
        url=f"{cfg.base_url}/reporter/{{rep}}/partner/{{origin}}/product/all/"
        "year/{y}/datatype/{reported|aveestimated}",
        headers={},
        extra_meta={
            "mode": "live",
            "version": version,
            "distribution": "local_only",
            "n_gaps": summary["n_gaps"],
        },
    )
    return {
        "source": "wits_trains",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
        "rows": summary["rows"],
        "n_gaps": summary["n_gaps"],
    }


def live_version(*, root: Path | None = None) -> str:
    """Version label from config/wits_trains.json (no cheap upstream probe)."""
    return load_config(root=root).version


def extract_from_fixture(
    version: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    src = fixture_root / "wits_trains" / "tariffs.csv"
    if not src.is_file():
        raise FileNotFoundError(src)
    dest = raw_source_dir("wits_trains", version, root=root) / "tariffs.csv"
    if dest.is_file() and not force:
        return {
            "source": "wits_trains",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url="fixture://wits_trains/tariffs.csv",
        headers={},
        extra_meta={"mode": "fixture", "version": version},
    )
    return {
        "source": "wits_trains",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }


def load_raw_tariffs(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"origin": str, "destination": str, "hs6": str})
    required = {"year", "origin", "destination", "hs6", "ahs"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing columns {sorted(missing)}")
    df["year"] = df["year"].astype(int)
    df["hs6"] = df["hs6"].str.zfill(6)
    return df
