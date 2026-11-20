"""BACI-derived country×product metrics (SPEC §4 country_product variables).

Computes IMPV, GRW, HHI, ASIASH, REEXP for every HS code at 2, 4 and 6 digits
present in the trade table, every importer and year. IMPC requires population
(optional join). UVGAP needs unit values and is omitted when quantity is absent.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from imsatlas_etl.pipeline.io_paths import curated_dir

ASIA_SUPPLIERS = frozenset({"CHN", "VNM"})
PRODUCT_VAR_IDS = ("IMPV", "GRW", "HHI", "ASIASH", "REEXP", "IMPC")


def _hs_levels(trade: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Return trade frames tagged with hs_code at hs2 / hs4 / hs6."""
    base = trade.copy()
    if "hs6" not in base.columns and "hs" in base.columns:
        base = base.rename(columns={"hs": "hs6"})
    if "hs2" not in base.columns:
        base["hs2"] = base["hs6"].astype(str).str.zfill(6).str.slice(0, 2)
    if "hs4" not in base.columns:
        base["hs4"] = base["hs6"].astype(str).str.zfill(6).str.slice(0, 4)
    base["hs6"] = base["hs6"].astype(str).str.zfill(6)
    out: dict[str, pd.DataFrame] = {}
    for level, col in (("hs2", "hs2"), ("hs4", "hs4"), ("hs6", "hs6")):
        chunk = base.copy()
        chunk["hs_code"] = chunk[col]
        chunk["hs_level"] = level
        out[level] = chunk
    return out


def _import_totals(flows: pd.DataFrame) -> pd.DataFrame:
    """Importer × year × hs_code import value and supplier shares."""
    imports = (
        flows.groupby(["year", "importer", "hs_code", "hs_level"], as_index=False)[
            "value_usd"
        ]
        .sum()
        .rename(columns={"importer": "iso3", "value_usd": "impv"})
    )
    by_supplier = flows.groupby(
        ["year", "importer", "hs_code", "exporter"],
        as_index=False,
    )["value_usd"].sum()
    by_supplier["total"] = by_supplier.groupby(
        ["year", "importer", "hs_code"],
    )["value_usd"].transform("sum")
    by_supplier = by_supplier.assign(
        share=by_supplier["value_usd"] / by_supplier["total"],
    )
    hhi = (
        by_supplier.assign(sq=by_supplier["share"] ** 2)
        .groupby(["year", "importer", "hs_code"], as_index=False)["sq"]
        .sum()
        .rename(columns={"importer": "iso3", "sq": "hhi"})
    )
    asia = by_supplier[by_supplier["exporter"].isin(ASIA_SUPPLIERS)]
    asia_sum = (
        asia.groupby(["year", "importer", "hs_code"], as_index=False)["value_usd"]
        .sum()
        .rename(columns={"importer": "iso3", "value_usd": "asia_usd"})
    )
    out = imports.merge(hhi, on=["year", "iso3", "hs_code"], how="left")
    out = out.merge(asia_sum, on=["year", "iso3", "hs_code"], how="left")
    out["asia_usd"] = out["asia_usd"].fillna(0.0)
    out["asiash"] = np.where(out["impv"] > 0, out["asia_usd"] / out["impv"], np.nan)
    return out


def _export_totals(flows: pd.DataFrame) -> pd.DataFrame:
    return (
        flows.groupby(["year", "exporter", "hs_code"], as_index=False)["value_usd"]
        .sum()
        .rename(columns={"exporter": "iso3", "value_usd": "expv"})
    )


def _cagr_3y(impv: pd.DataFrame) -> pd.DataFrame:
    """3-year CAGR of IMPV using years t-3 and t only (anti-leakage)."""
    rows: list[dict[str, Any]] = []
    keyed = {
        (int(r.year), str(r.iso3), str(r.hs_code)): float(r.impv)
        for r in impv.itertuples(index=False)
    }
    for (year, iso3, hs_code), value_t in keyed.items():
        value_prev = keyed.get((year - 3, iso3, hs_code))
        if value_prev is None or value_prev <= 0 or value_t <= 0:
            growth = np.nan
        else:
            growth = float((value_t / value_prev) ** (1.0 / 3.0) - 1.0)
        rows.append(
            {
                "year": year,
                "iso3": iso3,
                "hs_code": hs_code,
                "grw": growth,
            },
        )
    return pd.DataFrame(rows)


def compute_product_metrics(
    trade: pd.DataFrame,
    *,
    population: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """
    Long table: iso3, year, hs_code, hs_level, variable_id, value.

    ``population`` optional columns: iso3, year, value (population headcount).
    """
    if trade.empty:
        return pd.DataFrame(
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

    frames: list[pd.DataFrame] = []
    for _level, flows in _hs_levels(trade).items():
        imports = _import_totals(flows)
        exports = _export_totals(flows)
        growth = _cagr_3y(imports)
        panel = imports.merge(exports, on=["year", "iso3", "hs_code"], how="left")
        panel = panel.merge(growth, on=["year", "iso3", "hs_code"], how="left")
        panel["expv"] = panel["expv"].fillna(0.0)
        panel["reexp"] = np.where(
            panel["impv"] > 0,
            panel["expv"] / panel["impv"],
            np.nan,
        )
        panel["hs_level"] = flows["hs_level"].iloc[0]
        panel["hs2"] = panel["hs_code"].astype(str).str.zfill(2).str.slice(0, 2)

        if population is not None and not population.empty:
            pop = population.rename(columns={"value": "pop"})
            panel = panel.merge(pop, on=["iso3", "year"], how="left")
            panel["impc"] = np.where(
                panel["pop"].notna() & (panel["pop"] > 0),
                panel["impv"] / panel["pop"],
                np.nan,
            )
        else:
            panel["impc"] = np.nan

        long_parts = [
            panel.assign(variable_id="IMPV", value=panel["impv"]),
            panel.assign(variable_id="GRW", value=panel["grw"]),
            panel.assign(variable_id="HHI", value=panel["hhi"]),
            panel.assign(variable_id="ASIASH", value=panel["asiash"]),
            panel.assign(variable_id="REEXP", value=panel["reexp"]),
            panel.assign(variable_id="IMPC", value=panel["impc"]),
        ]
        for part in long_parts:
            frames.append(
                part[
                    [
                        "iso3",
                        "year",
                        "hs_code",
                        "hs_level",
                        "hs2",
                        "variable_id",
                        "value",
                    ]
                ],
            )

    out = pd.concat(frames, ignore_index=True)
    return out.sort_values(
        ["hs2", "hs_level", "hs_code", "year", "iso3", "variable_id"],
    ).reset_index(drop=True)


def write_product_metrics_partitioned(
    frame: pd.DataFrame,
    base: Path,
    *,
    max_file_bytes: int | None = None,
) -> dict[str, Any]:
    """Write ``country_product/hs2=XX/…`` partitions.

    Default layout is one file per HS2 chapter. When ``max_file_bytes`` is set
    (release size budget), nest ``year=`` / ``variable_id=`` and write a small
    ``index.json`` so browsers can load every part without HTTP globs.
    """
    base.mkdir(parents=True, exist_ok=True)
    sizes: dict[str, int] = {}
    if frame.empty:
        empty = base / "hs2=_empty" / "part.parquet"
        empty.parent.mkdir(parents=True, exist_ok=True)
        frame.to_parquet(empty, index=False)
        return {"parts": 1, "rows": 0, "bytes_by_hs2": {"_empty": empty.stat().st_size}}
    bytes_by: dict[str, int] = {}
    n_parts = 0
    for hs2, chunk in frame.groupby("hs2"):
        hs2_key = str(hs2)
        hs2_dir = base / f"hs2={hs2_key}"
        hs2_dir.mkdir(parents=True, exist_ok=True)
        # Drop any previous layout (single part or nested) before rewrite.
        for old in hs2_dir.rglob("part.parquet"):
            old.unlink()
        index_path = hs2_dir / "index.json"
        if index_path.is_file():
            index_path.unlink()

        if max_file_bytes is None:
            path = hs2_dir / "part.parquet"
            chunk.reset_index(drop=True).to_parquet(path, index=False)
            sizes[hs2_key] = int(len(chunk))
            bytes_by[hs2_key] = path.stat().st_size
            n_parts += 1
            continue

        part_paths: list[str] = []
        chapter_bytes = 0
        for (year, vid), sub in chunk.groupby(["year", "variable_id"], sort=True):
            rel = f"year={int(year)}/variable_id={vid}/part.parquet"
            path = hs2_dir / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            sub.reset_index(drop=True).to_parquet(path, index=False)
            size = path.stat().st_size
            if size > max_file_bytes:
                raise ValueError(
                    f"country_product hs2={hs2_key} {rel} is {size} bytes "
                    f"(max {max_file_bytes})",
                )
            part_paths.append(rel)
            chapter_bytes += size
            n_parts += 1
        index_path.write_text(
            json.dumps(
                {"hs2": hs2_key, "parts": part_paths, "rows": int(len(chunk))},
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        sizes[hs2_key] = int(len(chunk))
        bytes_by[hs2_key] = chapter_bytes
    return {
        "parts": n_parts,
        "rows": int(len(frame)),
        "bytes_by_hs2": bytes_by,
        "rows_by_hs2": sizes,
    }


def write_curated_product_metrics(
    trade: pd.DataFrame,
    *,
    root: Path | None = None,
    population: pd.DataFrame | None = None,
) -> dict[str, Any]:
    metrics = compute_product_metrics(trade, population=population)
    out_dir = curated_dir(root=root)
    flat = out_dir / "country_product.parquet"
    flat.parent.mkdir(parents=True, exist_ok=True)
    metrics.to_parquet(flat, index=False)
    parts = write_product_metrics_partitioned(
        metrics,
        out_dir / "country_product_by_hs2",
    )
    return {
        "rows": int(len(metrics)),
        "path": str(flat),
        "partitions": parts,
    }
