"""Build SPEC §3 release tables (long country/bilateral + trade/hs2=)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.gate import gate
from imsatlas_etl.pipeline.io_paths import curated_dir
from imsatlas_etl.rights import load_deployment
from imsatlas_etl.sources import sources_by_id

SHIP = frozenset({"ship_raw", "ship_derived"})
# SPEC §3 single-file browser budget (mirrored in release.py).
MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024
MIN_COUNTRY_PRODUCT_CHAPTERS = 90

COUNTRY_LONG_COLS = [
    "iso3",
    "year",
    "variable_id",
    "value",
    "flag_imputed",
    "flag_locf",
]
BILATERAL_LONG_COLS = [
    "iso3_o",
    "iso3_d",
    "year",
    "variable_id",
    "value",
    "flag_imputed",
    "flag_locf",
]
TRADE_COLS = ["exporter", "importer", "year", "value_usd", "quantity", "hs2"]

# Bilateral curated columns -> catalog variable ids
BILATERAL_MAP = {
    "distw": "DIST",
    "comlang_off": "LANG",
    "fta_wto": "FTA",
    "ahs_mean": "TARIF",
}


def _empty_country() -> pd.DataFrame:
    return pd.DataFrame(columns=COUNTRY_LONG_COLS)


def _empty_bilateral() -> pd.DataFrame:
    return pd.DataFrame(columns=BILATERAL_LONG_COLS)


def _empty_trade() -> pd.DataFrame:
    return pd.DataFrame(columns=TRADE_COLS)


def source_shippable(source_id: str) -> bool:
    registry = sources_by_id()
    deployment = load_deployment()
    source = registry.get(source_id)
    if not source:
        return False
    result = gate(source["rights"], None, deployment)
    return result["decision"] in SHIP


def build_country_year_long(
    *,
    root: Path | None,
    included_ids: set[str],
) -> pd.DataFrame:
    path = curated_dir(root=root) / "variables_country_year.parquet"
    if not path.is_file() or not included_ids:
        return _empty_country()
    wide = pd.read_parquet(path)
    cols = [c for c in wide.columns if c in included_ids]
    if not cols:
        return _empty_country()
    long = wide.melt(
        id_vars=["iso3", "year"],
        value_vars=cols,
        var_name="variable_id",
        value_name="value",
    )
    long["flag_imputed"] = False
    long["flag_locf"] = False
    long = long.dropna(subset=["value"])
    return (
        long[COUNTRY_LONG_COLS]
        .sort_values(["variable_id", "iso3", "year"])
        .reset_index(drop=True)
    )


def build_bilateral_year_long(
    *,
    root: Path | None,
    included_ids: set[str],
) -> pd.DataFrame:
    path = curated_dir(root=root) / "bilateral_year.parquet"
    if not path.is_file():
        return _empty_bilateral()
    wide = pd.read_parquet(path)
    frames: list[pd.DataFrame] = []
    for col, vid in BILATERAL_MAP.items():
        if vid not in included_ids or col not in wide.columns:
            continue
        chunk = wide[["origin", "destination", "year", col]].copy()
        chunk = chunk.rename(
            columns={
                "origin": "iso3_o",
                "destination": "iso3_d",
                col: "value",
            },
        )
        chunk["variable_id"] = vid
        chunk["flag_imputed"] = False
        chunk["flag_locf"] = False
        frames.append(chunk[BILATERAL_LONG_COLS])
    if not frames:
        return _empty_bilateral()
    out = pd.concat(frames, ignore_index=True)
    return out.sort_values(
        ["variable_id", "iso3_o", "iso3_d", "year"],
    ).reset_index(drop=True)


def build_trade_hs2(*, root: Path | None) -> pd.DataFrame:
    """Trade cube only if BACI source rights allow shipping."""
    if not source_shippable("baci"):
        return _empty_trade()
    path = curated_dir(root=root) / "trade_hs2.parquet"
    if not path.is_file():
        return _empty_trade()
    frame = pd.read_parquet(path)
    if "hs2" not in frame.columns:
        return _empty_trade()
    if "quantity" not in frame.columns:
        frame = frame.copy()
        frame["quantity"] = float("nan")
    out = frame[TRADE_COLS].copy()
    return out.sort_values(
        ["hs2", "year", "exporter", "importer"],
    ).reset_index(drop=True)


def write_trade_partitions(frame: pd.DataFrame, dest: Path) -> list[Path]:
    dest.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    if frame.empty:
        # Keep schema-only placeholder so the release tree is stable.
        path = dest / "hs2=_empty" / "part.parquet"
        path.parent.mkdir(parents=True, exist_ok=True)
        _empty_trade().to_parquet(path, index=False)
        written.append(path)
        return written
    for hs2, chunk in frame.groupby("hs2"):
        path = dest / f"hs2={hs2}" / "part.parquet"
        path.parent.mkdir(parents=True, exist_ok=True)
        chunk.drop(columns=["hs2"]).to_parquet(path, index=False)
        written.append(path)
    return written


def write_bilateral_table(
    frame: pd.DataFrame,
    dest: Path,
    *,
    max_file_bytes: int = MAX_SINGLE_FILE_BYTES,
) -> dict[str, Any]:
    """Write bilateral long table; split by variable_id when over the file budget."""
    mono = dest / "bilateral_year.parquet"
    parts_dir = dest / "bilateral_year"
    if parts_dir.exists():
        import shutil

        shutil.rmtree(parts_dir)
    if mono.exists():
        mono.unlink()

    if frame.empty:
        frame.to_parquet(mono, index=False)
        return {"rows": 0, "parts": 1, "layout": "single"}

    frame.to_parquet(mono, index=False)
    if mono.stat().st_size <= max_file_bytes:
        return {
            "rows": int(len(frame)),
            "parts": 1,
            "layout": "single",
            "bytes": mono.stat().st_size,
        }

    # Over budget: hive by variable_id so each part stays under the limit.
    mono.unlink()
    parts_dir.mkdir(parents=True, exist_ok=True)
    part_rels: list[str] = []
    for vid, chunk in frame.groupby("variable_id", sort=True):
        rel = f"variable_id={vid}/part.parquet"
        path = parts_dir / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        chunk.reset_index(drop=True).to_parquet(path, index=False)
        size = path.stat().st_size
        if size > max_file_bytes:
            raise ValueError(
                f"bilateral_year {rel} is {size} bytes (max {max_file_bytes})",
            )
        part_rels.append(rel)
    (parts_dir / "index.json").write_text(
        json.dumps(
            {"parts": part_rels, "rows": int(len(frame))},
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return {
        "rows": int(len(frame)),
        "parts": len(part_rels),
        "layout": "partitioned",
        "bytes_by_variable": {
            rel.split("=", 1)[1].split("/", 1)[0]: (parts_dir / rel).stat().st_size
            for rel in part_rels
        },
    }


def _curated_product_chapters(root: Path | None) -> int:
    by_hs2 = curated_dir(root=root) / "country_product_by_hs2"
    if not by_hs2.is_dir():
        return 0
    return sum(
        1
        for path in by_hs2.iterdir()
        if path.is_dir() and path.name.startswith("hs2=") and "_empty" not in path.name
    )


def write_country_product_partitions(
    *,
    root: Path | None,
    dest: Path,
    included_ids: set[str],
) -> dict[str, Any]:
    """Copy curated country_product partitions filtered by included variable ids."""
    from imsatlas_etl.pipeline.product_metrics import write_product_metrics_partitioned

    src = curated_dir(root=root) / "country_product.parquet"
    out = dest / "country_product"
    curated_chapters = _curated_product_chapters(root)

    if not source_shippable("baci"):
        empty = pd.DataFrame(
            columns=[
                "iso3",
                "year",
                "hs_code",
                "hs_level",
                "hs2",
                "variable_id",
                "value",
            ],
        )
        return write_product_metrics_partitioned(empty, out)

    if not src.is_file() or src.stat().st_size < 1024:
        if curated_chapters >= MIN_COUNTRY_PRODUCT_CHAPTERS:
            raise ValueError(
                "country_product.parquet missing/tiny while "
                f"country_product_by_hs2 has {curated_chapters} chapters — "
                "refuse empty release (rebuild flat parquet first)",
            )
        empty = pd.DataFrame(
            columns=[
                "iso3",
                "year",
                "hs_code",
                "hs_level",
                "hs2",
                "variable_id",
                "value",
            ],
        )
        return write_product_metrics_partitioned(empty, out)

    frame = pd.read_parquet(src)
    # Empty included_ids must not ship any product metrics (public until verified).
    if not included_ids:
        frame = frame.iloc[0:0]
    else:
        frame = frame[frame["variable_id"].isin(included_ids)]

    if frame.empty and curated_chapters >= MIN_COUNTRY_PRODUCT_CHAPTERS:
        raise ValueError(
            "country_product filter yielded 0 rows but curated has "
            f"{curated_chapters} HS2 chapters — check included variable ids",
        )

    meta = write_product_metrics_partitioned(
        frame,
        out,
        max_file_bytes=MAX_SINGLE_FILE_BYTES,
    )
    chapters = [key for key in (meta.get("bytes_by_hs2") or {}) if key != "_empty"]
    if (
        source_shippable("baci")
        and included_ids
        and len(chapters) < MIN_COUNTRY_PRODUCT_CHAPTERS
        and curated_chapters >= MIN_COUNTRY_PRODUCT_CHAPTERS
    ):
        raise ValueError(
            f"country_product release has {len(chapters)} chapters "
            f"(need ≥ {MIN_COUNTRY_PRODUCT_CHAPTERS}); "
            f"curated has {curated_chapters}",
        )
    return meta


def write_spec3_tables(
    dest: Path,
    *,
    root: Path | None,
    included_ids: set[str],
) -> dict[str, Any]:
    """Write SPEC §3 parquet layout into dest; return row counts."""
    country = build_country_year_long(root=root, included_ids=included_ids)
    bilateral = build_bilateral_year_long(root=root, included_ids=included_ids)
    trade = build_trade_hs2(root=root)

    country_path = dest / "country_year.parquet"
    country.to_parquet(country_path, index=False)
    bilateral_meta = write_bilateral_table(bilateral, dest)
    trade_paths = write_trade_partitions(trade, dest / "trade")
    product_meta = write_country_product_partitions(
        root=root,
        dest=dest,
        included_ids=included_ids,
    )

    return {
        "country_year_rows": int(len(country)),
        "bilateral_year_rows": int(len(bilateral)),
        "bilateral_layout": bilateral_meta.get("layout"),
        "bilateral_parts": int(bilateral_meta.get("parts", 0)),
        "trade_rows": int(len(trade)),
        "trade_parts": len(trade_paths),
        "country_product_rows": int(product_meta.get("rows", 0)),
        "country_product_parts": int(product_meta.get("parts", 0)),
        "country_product_bytes_by_hs2": product_meta.get("bytes_by_hs2", {}),
    }
