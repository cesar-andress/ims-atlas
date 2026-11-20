"""IMF World Economic Outlook via SDMX 3.0 CSV API (no key required).

Verified 2026-11-20: ``api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/9.0.0``
returns CSV with ``COUNTRY``, ``INDICATOR``, ``TIME_PERIOD``, ``OBS_VALUE``.

We pull a fixed indicator set used by the catalogue (growth, inflation, GDP
per capita PPP, current account, unemployment) for years >= 2010. Full bulk
``*`` is available but heavy; hourly runs use the same indicator filter.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pandas as pd

from imsatlas_etl.connectors.http import fetch_bytes, write_artifact
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir

SOURCE_ID = "imf_weo"
AGENCY = "IMF.RES"
DATAFLOW = "WEO"
VERSION = "9.0.0"
# Core WEO codes (catalog / IMSFE-adjacent). Expand only with verified codes.
INDICATORS = (
    "NGDP_RPCH",  # real GDP growth %
    "PCPIPCH",  # inflation, average consumer prices %
    "NGDPDPC",  # GDP per capita, current USD
    "PPPPC",  # GDP per capita, PPP
    "LUR",  # unemployment rate
    "BCA_NGDPD",  # current account % of GDP
)
API_ROOT = (
    f"https://api.imf.org/external/sdmx/3.0/data/dataflow/"
    f"{AGENCY}/{DATAFLOW}/{VERSION}/*"
)


def _data_url(*, year_from: int = 2010) -> str:
    # c[INDICATOR] accepts space-separated list in SDMX 3 filter syntax.
    ind = "+".join(INDICATORS)
    q = (
        f"c[TIME_PERIOD]=ge:{year_from}-01"
        f"&c[INDICATOR]={quote(ind, safe='+')}"
        f"&c[FREQUENCY]=A"
    )
    return f"{API_ROOT}?{q}"


def probe_version() -> dict[str, Any]:
    # Cheap probe: one indicator, one recent year window.
    url = (
        f"{API_ROOT}?c[TIME_PERIOD]=ge:2024-01"
        f"&c[INDICATOR]=NGDP_RPCH&c[FREQUENCY]=A&firstNObservations=5"
    )
    body, headers = fetch_bytes(
        url,
        timeout=60.0,
        extra_headers={"Accept": "text/csv"},
    )
    text = body.decode("utf-8", errors="replace")
    if "OBS_VALUE" not in text.split("\n", 1)[0]:
        raise ValueError(f"{SOURCE_ID}: unexpected SDMX CSV header")
    # Structure id embeds version, e.g. IMF.RES:WEO(9.0.0)
    ver = VERSION
    for line in text.splitlines()[:5]:
        if "WEO(" in line:
            start = line.find("WEO(") + 4
            end = line.find(")", start)
            if end > start:
                ver = line[start:end]
                break
    return {
        "upstream_version": f"weo-{ver}",
        "upstream_changed_at": headers.get("Last-Modified")
        or headers.get("last-modified"),
        "note": "IMF SDMX 3.0 WEO CSV probe",
        "bytes": len(body),
    }


def _parse_csv(body: bytes) -> pd.DataFrame:
    frame = pd.read_csv(io.BytesIO(body), low_memory=False)
    need = {"COUNTRY", "INDICATOR", "TIME_PERIOD", "OBS_VALUE"}
    missing = need - set(frame.columns)
    if missing:
        raise ValueError(f"{SOURCE_ID}: missing columns {sorted(missing)}")
    rows: list[dict[str, Any]] = []
    for rec in frame.itertuples(index=False):
        iso3 = str(rec.COUNTRY or "").strip().upper()
        if len(iso3) != 3 or not iso3.isalpha():
            continue
        period = str(rec.TIME_PERIOD or "").strip()
        if period.startswith("FY"):
            period = period[2:6]
        if not period.isdigit():
            continue
        year = int(period)
        if year < MIN_YEAR:
            continue
        val = rec.OBS_VALUE
        if val is None or (isinstance(val, float) and pd.isna(val)):
            continue
        try:
            value = float(val)
        except (TypeError, ValueError):
            continue
        indicator = str(rec.INDICATOR or "").strip()
        if not indicator:
            continue
        rows.append(
            {
                "iso3": iso3,
                "year": year,
                "indicator": indicator,
                "value": value,
            },
        )
    if not rows:
        raise ValueError(f"{SOURCE_ID}: no usable observations")
    out = pd.DataFrame.from_records(rows)
    return out.sort_values(["indicator", "iso3", "year"]).reset_index(drop=True)


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    from imsatlas_etl.connectors import manual_drop
    from imsatlas_etl.connectors.step3 import has_manual_drop

    if has_manual_drop(SOURCE_ID, root=root):
        return manual_drop.extract_live(SOURCE_ID, version, root=root, force=force)
    dest = raw_source_dir(SOURCE_ID, version, root=root) / "indicators.csv"
    if dest.is_file() and not force:
        return {
            "source": SOURCE_ID,
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    url = _data_url()
    body, headers = fetch_bytes(
        url,
        timeout=180.0,
        extra_headers={"Accept": "text/csv"},
    )
    # Keep verbatim SDMX CSV next to tidy table.
    raw_path = dest.parent / "weo_sdmx.csv"
    write_artifact(
        raw_path,
        body,
        url=url,
        headers=headers,
        extra_meta={"mode": "live", "version": version},
    )
    table = _parse_csv(body)
    meta = write_artifact(
        dest,
        table.to_csv(index=False).encode("utf-8"),
        url=url,
        headers=headers,
        extra_meta={
            "mode": "live",
            "version": version,
            "n_rows": int(len(table)),
            "indicators": list(INDICATORS),
        },
    )
    return {
        "source": SOURCE_ID,
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
        "rows": int(len(table)),
    }
