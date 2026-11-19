"""CEPII Gravity connector (fixture + manual zip drop; never downloads)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors.http import write_artifact, write_file_meta
from imsatlas_etl.connectors.manual import (
    find_drop,
    load_pin,
    manual_version,
    safe_extract,
    verify_pin,
)
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir

CHUNK_ROWS = 500_000

# Canonical column -> accepted source names (first match wins). The catalog
# variable is distw_harmonic, so it is preferred over plain distw.
COLUMN_ALIASES: dict[str, list[str]] = {
    "origin": ["iso3_o", "iso3o", "iso_o"],
    "destination": ["iso3_d", "iso3d", "iso_d"],
    "year": ["year", "year_id"],
    "distw": ["distw_harmonic", "distw"],
    "comlang_off": ["comlang_off"],
    "fta_wto": ["fta_wto"],
}


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


def pick_columns(columns: list[str]) -> dict[str, str]:
    """Resolve canonical -> actual column names; raise listing what is missing."""
    lower = {c.lower(): c for c in columns}
    mapping: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower:
                mapping[canonical] = lower[alias]
                break
    missing = [c for c in COLUMN_ALIASES if c not in mapping]
    if missing:
        raise ValueError(
            f"Gravity file missing {missing}; available={columns[:30]}",
        )
    return mapping


def normalize_gravity(
    frames: list[pd.DataFrame],
    *,
    year_min: int = MIN_YEAR,
    year_max: int | None = None,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Canonical-column frames -> raw bilateral contract; count every discard."""
    raw = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    counts = {
        "n_in": len(raw),
        "n_out_of_years": 0,
        "n_duplicate_keys": 0,
        "n_incomplete": 0,
    }
    if raw.empty:
        return raw, counts
    raw["year"] = pd.to_numeric(raw["year"], errors="coerce")
    keep = raw["year"].ge(year_min)
    if year_max is not None:
        keep &= raw["year"].le(year_max)
    counts["n_out_of_years"] = int((~keep).sum())
    raw = raw[keep].copy()
    raw["year"] = raw["year"].astype(int)
    values = ["distw", "comlang_off", "fta_wto"]
    raw["_nnz"] = raw[values].notna().sum(axis=1)
    key = ["origin", "destination", "year"]
    raw = raw.sort_values(key + ["_nnz"], ascending=[True, True, True, False])
    deduped = raw.drop_duplicates(key, keep="first")
    counts["n_duplicate_keys"] = len(raw) - len(deduped)
    complete = deduped[values].notna().all(axis=1)
    counts["n_incomplete"] = int((~complete).sum())
    out = deduped[complete].drop(columns=["_nnz"]).copy()
    out["comlang_off"] = out["comlang_off"].astype(int)
    out["fta_wto"] = out["fta_wto"].astype(int)
    return out[["origin", "destination", "year", *values]].reset_index(
        drop=True
    ), counts


def _read_filtered(path: Path, mapping: dict[str, str]) -> list[pd.DataFrame]:
    inverse = {actual: canonical for canonical, actual in mapping.items()}
    frames: list[pd.DataFrame] = []
    for chunk in pd.read_csv(
        path,
        usecols=list(mapping.values()),
        dtype={mapping["origin"]: str, mapping["destination"]: str},
        chunksize=CHUNK_ROWS,
        low_memory=False,
    ):
        frames.append(chunk.rename(columns=inverse))
    return frames


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Unzip the dropped Gravity archive and normalise to ``bilateral.csv``.

    The archive must be placed by a human in ``data/manual/cepi_gravity/``. No
    CEPII URL is ever fetched or assumed; ``config/pins/cepi_gravity.json`` may
    carry ``url: null``.
    """
    dest_dir = raw_source_dir("cepi_gravity", version, root=root)
    dest = dest_dir / "bilateral.csv"
    if dest.is_file() and not force:
        return {
            "source": "cepi_gravity",
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    archive = find_drop("cepi_gravity", root=root, suffix=".zip")
    pin = load_pin("cepi_gravity", root=root)
    observed = verify_pin(archive, pin) if pin else None
    options = (pin.options if pin else None) or {}
    base = dest_dir / "zip_members"
    members = safe_extract(archive, base)
    csvs = sorted(base.rglob("*.csv"), key=lambda p: p.stat().st_size, reverse=True)
    if not csvs:
        raise FileNotFoundError("Gravity zip contains no CSV member")
    main_csv = csvs[0]  # the main table is the largest CSV
    header = list(pd.read_csv(main_csv, nrows=0).columns)
    mapping = pick_columns(header)
    year_max = int(options["year_max"]) if options.get("year_max") is not None else None
    table, counts = normalize_gravity(
        _read_filtered(main_csv, mapping),
        year_min=int(options.get("year_min", MIN_YEAR)),
        year_max=year_max,
    )
    if table.empty:
        raise ValueError("Gravity normalisation produced no rows")
    table.to_csv(dest, index=False)
    meta = write_file_meta(
        dest,
        url=f"manual://cepi_gravity/{archive.name}",
        extra_meta={
            "mode": "live",
            "input": "manual_zip",
            "version": version,
            "archive": archive.name,
            "archive_sha256": (observed or {}).get("sha256"),
            "archive_bytes": archive.stat().st_size,
            "pin_checked": bool(observed and observed["pin_checked"]),
            "pin_url": pin.url if pin else None,
            "source_csv": main_csv.name,
            "column_map": mapping,
            "rows": int(len(table)),
            "discards": counts,
            "members": members,
        },
    )
    return {
        "source": "cepi_gravity",
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
        "rows": int(len(table)),
        "discards": counts,
    }


def live_version(*, root: Path | None = None) -> str:
    """Version string for the dropped archive (pin version or content hash)."""
    archive = find_drop("cepi_gravity", root=root, suffix=".zip")
    return manual_version("cepi_gravity", archive, root=root)
