"""Step 4: pure transforms to curated country/bilateral/trade tables."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors import baci, gravity, hofstede, wits
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.pipeline.io_paths import (
    curated_dir,
    freshness_path,
    raw_source_dir,
    status_root,
)
from imsatlas_etl.pipeline.product_metrics import write_curated_product_metrics
from imsatlas_etl.pipeline.variables_build import write_variables_country_year


def _versions(*, root: Path | None) -> dict[str, str]:
    payload = json.loads(freshness_path(root=root).read_text(encoding="utf-8"))
    return {row["source"]: str(row["upstream_version"]) for row in payload["sources"]}


def _wb_wide(source_id: str, version: str, *, root: Path | None) -> pd.DataFrame:
    path = raw_source_dir(source_id, version, root=root) / "indicators.csv"
    long = wb.load_raw_indicators(path)
    wide = long.pivot_table(
        index=["iso3", "year"],
        columns="indicator",
        values="value",
        aggfunc="first",
    ).reset_index()
    wide.columns.name = None
    return wide


def build_country_year(*, root: Path | None = None) -> pd.DataFrame:
    versions = _versions(root=root)
    frames = [
        _wb_wide("worldbank_wdi", versions["worldbank_wdi"], root=root),
        _wb_wide("worldbank_wgi", versions["worldbank_wgi"], root=root),
        _wb_wide("worldbank_lpi", versions["worldbank_lpi"], root=root),
    ]
    out = frames[0]
    for frame in frames[1:]:
        out = out.merge(frame, on=["iso3", "year"], how="outer")

    hof = hofstede.load_raw_dimensions(
        raw_source_dir("hofstede", versions["hofstede"], root=root) / "dimensions.csv",
    )
    # Hofstede is time-invariant in the mini world: broadcast to all years.
    years = sorted(out["year"].dropna().unique())
    hof_rows = []
    for year in years:
        chunk = hof.copy()
        chunk["year"] = int(year)
        hof_rows.append(chunk)
    hof_panel = pd.concat(hof_rows, ignore_index=True) if hof_rows else hof
    out = out.merge(hof_panel, on=["iso3", "year"], how="left")
    return out.sort_values(["iso3", "year"]).reset_index(drop=True)


def build_bilateral_year(*, root: Path | None = None) -> pd.DataFrame:
    versions = _versions(root=root)
    grav = gravity.load_raw_bilateral(
        raw_source_dir("cepi_gravity", versions["cepi_gravity"], root=root)
        / "bilateral.csv",
    )
    tariffs = wits.load_raw_tariffs(
        raw_source_dir(
            "wits_trains",
            versions["wits_trains"],
            root=root,
        )
        / "tariffs.csv",
    )
    # Preferential tariff at bilateral×hs6 is too fine for bilateral_year;
    # store mean AHS across products as a bilateral summary column.
    tariff_mean = (
        tariffs.groupby(["year", "origin", "destination"], as_index=False)["ahs"]
        .mean()
        .rename(columns={"ahs": "ahs_mean"})
    )
    out = grav.merge(tariff_mean, on=["year", "origin", "destination"], how="left")
    return out.sort_values(["year", "origin", "destination"]).reset_index(drop=True)


def build_trade_tables(
    *,
    root: Path | None = None,
) -> dict[str, pd.DataFrame]:
    versions = _versions(root=root)
    trade = baci.load_raw_trade(
        raw_source_dir("baci", versions["baci"], root=root) / "trade.csv",
    )
    hs6 = trade.copy()
    hs4 = (
        trade.groupby(["year", "exporter", "importer", "hs4"], as_index=False)[
            "value_usd"
        ]
        .sum()
        .assign(hs2=lambda d: d["hs4"].str.slice(0, 2))
    )
    hs2 = trade.groupby(["year", "exporter", "importer", "hs2"], as_index=False)[
        "value_usd"
    ].sum()
    return {"trade_hs6": hs6, "trade_hs4": hs4, "trade_hs2": hs2}


def _write_parquet(frame: pd.DataFrame, path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(path, index=False)
    return int(len(frame))


def write_trade_hs6_partitioned(frame: pd.DataFrame, base: Path) -> int:
    """Partition HS6 by hs4 for product-scoped fetches."""
    total = 0
    for hs4, chunk in frame.groupby("hs4"):
        path = base / f"hs4={hs4}" / "part.parquet"
        total += _write_parquet(chunk.reset_index(drop=True), path)
    return total


def run_transform(
    *,
    root: Path | None = None,
    force: bool = False,  # noqa: ARG001
) -> dict[str, Any]:
    out_dir = curated_dir(root=root)
    country = build_country_year(root=root)
    bilateral = build_bilateral_year(root=root)
    trades = build_trade_tables(root=root)

    variables = write_variables_country_year(root=root)
    # Population for IMPC when WDI SP.POP.TOTL is in the country panel.
    population = None
    if "SP.POP.TOTL" in country.columns:
        population = (
            country[["iso3", "year", "SP.POP.TOTL"]]
            .rename(columns={"SP.POP.TOTL": "value"})
            .dropna()
        )
    product = write_curated_product_metrics(
        trades["trade_hs6"],
        root=root,
        population=population,
    )
    chapters_path = status_root(root=root) / "hs_chapters.json"
    chapters_path.parent.mkdir(parents=True, exist_ok=True)
    chapters_path.write_text(
        json.dumps(
            {
                "schema": "hs-chapters/v1",
                "hs_nomenclature": "HS2017",
                "country_product_rows": product["rows"],
                "bytes_by_hs2": product["partitions"].get("bytes_by_hs2", {}),
                "rows_by_hs2": product["partitions"].get("rows_by_hs2", {}),
                "budget_max_single_file_bytes": 5_242_880,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    counts = {
        "country_year": _write_parquet(country, out_dir / "country_year.parquet"),
        "bilateral_year": _write_parquet(
            bilateral,
            out_dir / "bilateral_year.parquet",
        ),
        "trade_hs2": _write_parquet(trades["trade_hs2"], out_dir / "trade_hs2.parquet"),
        "trade_hs4": _write_parquet(trades["trade_hs4"], out_dir / "trade_hs4.parquet"),
        "trade_hs6": write_trade_hs6_partitioned(
            trades["trade_hs6"],
            out_dir / "trade_hs6",
        ),
        "variables_country_year": variables["rows"],
        "country_product": product["rows"],
    }
    return {
        "curated_dir": str(out_dir),
        "row_counts": counts,
        "variables_meta": variables["meta"],
        "product_partitions": product["partitions"],
    }
