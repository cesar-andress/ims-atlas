"""WITS/TRAINS tariff connector (fixture-first; live requires registration)."""

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
