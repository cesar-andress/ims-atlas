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


def _data_url(indicator: str, *, year_from: int = 2010) -> str:
    # One indicator per request: multi-indicator ``+`` filters often return
    # an empty STRUCTURE CSV or JSON from this API.
    q = (
        f"c[TIME_PERIOD]=ge:{year_from}-01"
        f"&c[INDICATOR]={quote(indicator, safe='')}"
        f"&c[FREQUENCY]=A"
    )
    return f"{API_ROOT}?{q}"


def probe_version() -> dict[str, Any]:
    # Cheap probe: one indicator, one recent year window.
    url = _data_url("NGDP_RPCH", year_from=2024) + "&firstNObservations=5"
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
    frames: list[pd.DataFrame] = []
    last_headers: dict[str, str] = {}
    last_url = ""
    for ind in INDICATORS:
        url = _data_url(ind)
        last_url = url
        body, headers = fetch_bytes(
            url,
            timeout=180.0,
            extra_headers={"Accept": "text/csv"},
        )
        last_headers = headers
        head = body[:80].lstrip()
        if head.startswith(b"{") or head.startswith(b"["):
            raise ValueError(
                f"{SOURCE_ID}: API returned JSON instead of CSV for {ind} "
                f"(first bytes={head[:40]!r})",
            )
        write_artifact(
            dest.parent / f"weo_{ind}.csv",
            body,
            url=url,
            headers=headers,
            extra_meta={"mode": "live", "version": version, "indicator": ind},
        )
        frames.append(_parse_csv(body))
    table = pd.concat(frames, ignore_index=True)
    table = table.sort_values(["indicator", "iso3", "year"]).reset_index(drop=True)
    meta = write_artifact(
        dest,
        table.to_csv(index=False).encode("utf-8"),
        url=last_url,
        headers=last_headers,
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
