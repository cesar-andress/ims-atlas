"""CEPII Gravity connector (fixture-first)."""

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
    src = fixture_root / "cepi_gravity" / "bilateral.csv"
    if not src.is_file():
        raise FileNotFoundError(src)
    dest = raw_source_dir("cepi_gravity", version, root=root) / "bilateral.csv"
    if dest.is_file() and not force:
        return {
            "source": "cepi_gravity",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url="fixture://cepi_gravity/bilateral.csv",
        headers={},
        extra_meta={"mode": "fixture", "version": version},
    )
    return {
        "source": "cepi_gravity",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }


def load_raw_bilateral(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"origin": str, "destination": str})
    required = {"origin", "destination", "year", "distw", "comlang_off", "fta_wto"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing columns {sorted(missing)}")
    df["year"] = df["year"].astype(int)
    return df
