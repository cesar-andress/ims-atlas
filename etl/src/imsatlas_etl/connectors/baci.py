"""BACI trade connector (fixture-first)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import write_artifact
from imsatlas_etl.pipeline.io_paths import raw_source_dir


def extract_from_fixture(
    version: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    src = fixture_root / "baci" / "trade.csv"
    if not src.is_file():
        raise FileNotFoundError(src)
    dest = raw_source_dir("baci", version, root=root) / "trade.csv"
    if dest.is_file() and not force:
        return {
            "source": "baci",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url="fixture://baci/trade.csv",
        headers={},
        extra_meta={"mode": "fixture", "version": version},
    )
    return {
        "source": "baci",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }


def load_raw_trade(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"hs6": str, "exporter": str, "importer": str})
    required = {"year", "exporter", "importer", "hs6", "value_usd"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing columns {sorted(missing)}")
    df["year"] = df["year"].astype(int)
    df["hs6"] = df["hs6"].str.zfill(6)
    df["hs4"] = df["hs6"].str.slice(0, 4)
    df["hs2"] = df["hs6"].str.slice(0, 2)
    return df
