"""ECB euro foreign-exchange reference rates (daily XML)."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import fetch_bytes, write_artifact
from imsatlas_etl.pipeline.io_paths import raw_source_dir

DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
NS = {
    "gesmes": "http://www.gesmes.org/xml/2002-08-01",
    "ecb": "http://www.ecb.int/vocabulary/2002-08-01/eurofxref",
}


def probe_version() -> dict[str, Any]:
    body, headers = fetch_bytes(DAILY_URL, timeout=30.0)
    root = ET.fromstring(body)
    time_el = root.find(
        ".//{http://www.ecb.int/vocabulary/2002-08-01/eurofxref}Cube[@time]"
    )
    day = time_el.get("time") if time_el is not None else None
    return {
        "upstream_version": f"ecb-{day or 'unknown'}",
        "upstream_changed_at": day,
        "note": "ECB eurofxref daily XML",
        "bytes": len(body),
    }


def _parse(body: bytes) -> pd.DataFrame:
    root = ET.fromstring(body)
    time_el = root.find(
        ".//{http://www.ecb.int/vocabulary/2002-08-01/eurofxref}Cube[@time]"
    )
    if time_el is None:
        raise ValueError("ecb_fx: missing time cube")
    day = time_el.get("time")
    year = int(str(day)[:4]) if day else None
    rows: list[dict[str, Any]] = []
    for cube in time_el.findall(
        "{http://www.ecb.int/vocabulary/2002-08-01/eurofxref}Cube",
    ):
        cur = cube.get("currency")
        rate = cube.get("rate")
        if not cur or not rate:
            continue
        rows.append(
            {
                "currency": cur,
                "year": year,
                "date": day,
                "indicator": "EUR_FX",
                "value": float(rate),
            },
        )
    if not rows:
        raise ValueError("ecb_fx: no rates")
    return pd.DataFrame.from_records(rows)


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    dest = raw_source_dir("ecb_fx", version, root=root) / "indicators.csv"
    if dest.is_file() and not force:
        return {
            "source": "ecb_fx",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    body, headers = fetch_bytes(DAILY_URL, timeout=45.0)
    frame = _parse(body)
    meta = write_artifact(
        dest,
        frame.to_csv(index=False).encode("utf-8"),
        url=DAILY_URL,
        headers=headers,
        extra_meta={"mode": "live", "version": version, "n_rows": int(len(frame))},
    )
    return {
        "source": "ecb_fx",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
        "rows": int(len(frame)),
    }


def extract_from_fixture(
    version: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    src = fixture_root / "ecb_fx" / "indicators.csv"
    if not src.is_file():
        raise FileNotFoundError(src)
    dest = raw_source_dir("ecb_fx", version, root=root) / "indicators.csv"
    if dest.is_file() and not force:
        return {
            "source": "ecb_fx",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url="fixture://ecb_fx/indicators.csv",
        headers={},
        extra_meta={"mode": "fixture", "version": version},
    )
    return {
        "source": "ecb_fx",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }
