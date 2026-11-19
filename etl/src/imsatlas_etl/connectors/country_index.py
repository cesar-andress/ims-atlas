"""Generic country-year index connector (fixture-first for Phase 3 sources)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import write_artifact
from imsatlas_etl.iso3 import map_country_column
from imsatlas_etl.pipeline.io_paths import raw_source_dir

# Official landing URLs recorded for Phase 3 (access date in notes; no scrape).
SOURCE_LANDING: dict[str, dict[str, str]] = {
    "itu_datahub": {
        "landing_url": "https://datahub.itu.int/",
        "access_date": "2026-11-19",
        "notes": (
            "IDI via ITU DataHub; CC BY-NC-SA 3.0 IGO stated on About. "
            "No machine-readable bulk endpoint confirmed this session — BYOD fixture."
        ),
    },
    "ef_epi": {
        "landing_url": "https://www.ef.com/wwen/epi/",
        "access_date": "2026-11-19",
        "notes": "EF EPI landing; redistribution terms unclear — BYOD fixture only.",
    },
    "odin": {
        "landing_url": "https://odin.opendatawatch.com/",
        "access_date": "2026-11-19",
        "notes": ("ODIN site shows CC BY icon; download licence not confirmed — BYOD."),
    },
    "gedi": {
        "landing_url": "https://thegedi.org/",
        "access_date": "2026-11-19",
        "notes": "GEI last editions ~2019; no open licence confirmed — BYOD.",
    },
    "wipo_gii": {
        "landing_url": "https://www.wipo.int/global_innovation_index/en/",
        "access_date": "2026-11-19",
        "notes": (
            "GII publication cites CC BY 4.0; confirm database file terms before ship."
        ),
    },
    "startupblink": {
        "landing_url": "https://www.startupblink.com/",
        "access_date": "2026-11-19",
        "notes": "Likely proprietary ranking — BYOD fixture only; do not scrape.",
    },
    "yale_epi": {
        "landing_url": "https://epi.yale.edu/",
        "access_date": "2026-11-19",
        "notes": "EPI downloads CC BY-NC-SA 4.0 — non-commercial; BYOD / not shipped.",
    },
}


def extract_from_fixture(
    source_id: str,
    version: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    src = fixture_root / source_id / "values.csv"
    if not src.is_file():
        raise FileNotFoundError(src)
    dest = raw_source_dir(source_id, version, root=root) / "values.csv"
    if dest.is_file() and not force:
        return {
            "source": source_id,
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url=f"fixture://{source_id}/values.csv",
        headers={},
        extra_meta={
            "mode": "fixture",
            "version": version,
            **SOURCE_LANDING.get(source_id, {}),
        },
    )
    return {
        "source": source_id,
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }


def load_raw_values(path: Path) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Load values.csv with country_name and/or iso3; map names explicitly."""
    df = pd.read_csv(path)
    required = {"year", "value"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path}: missing columns {sorted(missing)}")
    if "iso3" not in df.columns and "country_name" not in df.columns:
        raise ValueError(f"{path}: need iso3 and/or country_name")
    if "country_name" not in df.columns:
        df["country_name"] = pd.NA
    mapped, unmatched = map_country_column(df)
    mapped["year"] = mapped["year"].astype(int)
    mapped["value"] = pd.to_numeric(mapped["value"], errors="coerce")
    return mapped[["iso3", "year", "value"]], unmatched
