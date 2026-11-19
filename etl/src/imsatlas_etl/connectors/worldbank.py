"""World Bank WDI/WGI/LPI connectors (fixture + live probe)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import fetch_bytes, write_artifact
from imsatlas_etl.pipeline.io_paths import raw_source_dir

# Representative codes for version probes (one per source family).
PROBE_CODES = {
    "worldbank_wdi": "NY.GDP.PCAP.PP.KD",
    "worldbank_wgi": "CC.EST",
    "worldbank_lpi": "LP.LPI.OVRL.XQ",
}


def indicator_url(code: str) -> str:
    return (
        "https://api.worldbank.org/v2/country/all/indicator/"
        f"{code}?format=json&per_page=1"
    )


def probe_version(source_id: str) -> dict[str, Any]:
    code = PROBE_CODES[source_id]
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
