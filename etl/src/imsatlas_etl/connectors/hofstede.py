"""Hofstede dimension matrix connector (fixture-first / local)."""

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
    src = fixture_root / "hofstede" / "dimensions.csv"
    if not src.is_file():
        raise FileNotFoundError(src)
    dest = raw_source_dir("hofstede", version, root=root) / "dimensions.csv"
    if dest.is_file() and not force:
        return {
            "source": "hofstede",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url="fixture://hofstede/dimensions.csv",
        headers={},
        extra_meta={"mode": "fixture", "version": version},
    )
    return {
        "source": "hofstede",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }


def load_raw_dimensions(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"iso3": str})
    required = {"iso3", "pdi", "idv", "mas", "uai", "ltowvs", "ivr"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing columns {sorted(missing)}")
    return df
