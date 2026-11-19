"""Build SPEC §3 release tables (long country/bilateral + trade/hs2=)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.gate import gate
from imsatlas_etl.pipeline.io_paths import curated_dir
from imsatlas_etl.rights import load_deployment
from imsatlas_etl.sources import sources_by_id

SHIP = frozenset({"ship_raw", "ship_derived"})

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
TRADE_COLS = ["exporter", "importer", "year", "value_usd", "hs2"]

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
    bilateral_path = dest / "bilateral_year.parquet"
    country.to_parquet(country_path, index=False)
    bilateral.to_parquet(bilateral_path, index=False)
    trade_paths = write_trade_partitions(trade, dest / "trade")

    return {
        "country_year_rows": int(len(country)),
        "bilateral_year_rows": int(len(bilateral)),
        "trade_rows": int(len(trade)),
        "trade_parts": len(trade_paths),
    }
