"""Step 4: pure transforms to curated country/bilateral/trade tables.

Partial live runs are allowed: sources without extracted raw tables become
null columns and are listed in ``missing_sources``. Live mode never copies
fixture curated tables.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors import baci, gravity, hofstede, wits
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.pipeline.io_paths import (
    TABLE_FILES,
    curated_dir,
    freshness_path,
    raw_source_dir,
    status_root,
)
from imsatlas_etl.pipeline.product_metrics import write_curated_product_metrics
from imsatlas_etl.pipeline.step3_sources import summarize_step3_sources
from imsatlas_etl.pipeline.variables_build import write_variables_country_year

EMPTY_BILATERAL = pd.DataFrame(
    columns=[
        "year",
        "origin",
        "destination",
        "distw",
        "comlang_off",
        "fta_wto",
        "contig",
        "ahs_mean",
    ],
)
EMPTY_TRADE = pd.DataFrame(
    columns=["year", "exporter", "importer", "hs6", "hs4", "hs2", "value_usd"],
)


def _versions(*, root: Path | None) -> dict[str, str]:
    path = freshness_path(root=root)
    if not path.is_file():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for row in payload.get("sources", []):
        sid = str(row.get("source") or "")
        ver = row.get("ingested_version") or row.get("upstream_version")
        if not sid or ver is None:
            continue
        ver_s = str(ver).strip()
        if not ver_s or ver_s.lower() == "none":
            continue
        out[sid] = ver_s
    return out


def _raw_table_path(source_id: str, version: str, *, root: Path | None) -> Path | None:
    base = raw_source_dir(source_id, version, root=root)
    if not base.is_dir():
        return None
    for name in TABLE_FILES:
        candidate = base / name
        if candidate.is_file():
            return candidate
    return None


def _missing(missing: list[dict[str, str]], source_id: str, reason: str) -> None:
    if any(row["id"] == source_id for row in missing):
        return
    missing.append({"id": source_id, "reason": reason})


def _wb_wide(
    source_id: str,
    version: str,
    *,
    root: Path | None,
    missing: list[dict[str, str]],
) -> pd.DataFrame | None:
    path = _raw_table_path(source_id, version, root=root)
    if path is None or path.name != "indicators.csv":
        _missing(missing, source_id, "no indicators.csv in raw version dir")
        return None
    long = wb.load_raw_indicators(path)
    if long.empty:
        _missing(missing, source_id, "indicators.csv is empty")
        return None
    wide = long.pivot_table(
        index=["iso3", "year"],
        columns="indicator",
        values="value",
        aggfunc="first",
    ).reset_index()
    wide.columns.name = None
    return wide


def build_country_year(
    *,
    root: Path | None = None,
    missing: list[dict[str, str]] | None = None,
) -> pd.DataFrame:
    versions = _versions(root=root)
    miss = missing if missing is not None else []
    frames: list[pd.DataFrame] = []
    for source_id in ("worldbank_wdi", "worldbank_wgi", "worldbank_lpi"):
        if source_id not in versions:
            _missing(miss, source_id, "not in freshness.json")
            continue
        wide = _wb_wide(source_id, versions[source_id], root=root, missing=miss)
        if wide is not None:
            frames.append(wide)

    if not frames:
        out = pd.DataFrame(columns=["iso3", "year"])
    else:
        out = frames[0]
        for frame in frames[1:]:
            out = out.merge(frame, on=["iso3", "year"], how="outer")

    if "hofstede" not in versions:
        _missing(miss, "hofstede", "not in freshness.json")
    else:
        hof_path = _raw_table_path("hofstede", versions["hofstede"], root=root)
        if hof_path is None or hof_path.name != "dimensions.csv":
            _missing(miss, "hofstede", "no dimensions.csv in raw version dir")
        else:
            hof = hofstede.load_raw_dimensions(hof_path)
            years = sorted(out["year"].dropna().unique()) if not out.empty else []
            if years:
                hof_rows = []
                for year in years:
                    chunk = hof.copy()
                    chunk["year"] = int(year)
                    hof_rows.append(chunk)
                hof_panel = pd.concat(hof_rows, ignore_index=True)
                out = out.merge(hof_panel, on=["iso3", "year"], how="left")
            elif not out.empty:
                out = out.merge(hof.assign(year=pd.NA), on=["iso3"], how="left")

    if out.empty:
        return out
    return out.sort_values(["iso3", "year"]).reset_index(drop=True)


def build_bilateral_year(
    *,
    root: Path | None = None,
    missing: list[dict[str, str]] | None = None,
) -> pd.DataFrame:
    versions = _versions(root=root)
    miss = missing if missing is not None else []
    out = EMPTY_BILATERAL.copy()

    if "cepi_gravity" not in versions:
        _missing(miss, "cepi_gravity", "not in freshness.json")
        grav = None
    else:
        path = _raw_table_path("cepi_gravity", versions["cepi_gravity"], root=root)
        if path is None or path.name != "bilateral.csv":
            _missing(miss, "cepi_gravity", "no bilateral.csv in raw version dir")
            grav = None
        else:
            grav = gravity.load_raw_bilateral(path)

    if "wits_trains" not in versions:
        _missing(miss, "wits_trains", "not in freshness.json")
        tariffs = None
    else:
        path = _raw_table_path("wits_trains", versions["wits_trains"], root=root)
        if path is None or path.name != "tariffs.csv":
            _missing(miss, "wits_trains", "no tariffs.csv in raw version dir")
            tariffs = None
        else:
            tariffs = wits.load_raw_tariffs(path)

    if grav is None:
        return out
    if tariffs is None or tariffs.empty:
        return grav.sort_values(["year", "origin", "destination"]).reset_index(
            drop=True
        )

    tariff_mean = (
        tariffs.groupby(["year", "origin", "destination"], as_index=False)["ahs"]
        .mean()
        .rename(columns={"ahs": "ahs_mean"})
    )
    merged = grav.merge(tariff_mean, on=["year", "origin", "destination"], how="left")
    return merged.sort_values(["year", "origin", "destination"]).reset_index(drop=True)


def build_trade_tables(
    *,
    root: Path | None = None,
    missing: list[dict[str, str]] | None = None,
) -> dict[str, pd.DataFrame]:
    versions = _versions(root=root)
    miss = missing if missing is not None else []
    empty = {
        "trade_hs6": EMPTY_TRADE.copy(),
        "trade_hs4": EMPTY_TRADE.copy(),
        "trade_hs2": EMPTY_TRADE.copy(),
    }
    if "baci" not in versions:
        _missing(miss, "baci", "not in freshness.json")
        return empty
    path = _raw_table_path("baci", versions["baci"], root=root)
    if path is None or path.name != "trade.csv":
        _missing(miss, "baci", "no trade.csv in raw version dir")
        return empty
    trade = baci.load_raw_trade(path)
    if trade.empty:
        _missing(miss, "baci", "trade.csv is empty")
        return empty
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
    if frame.empty:
        empty = base / "hs4=_empty" / "part.parquet"
        return _write_parquet(frame, empty)
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
    missing: list[dict[str, str]] = []
    country = build_country_year(root=root, missing=missing)
    bilateral = build_bilateral_year(root=root, missing=missing)
    trades = build_trade_tables(root=root, missing=missing)

    variables = write_variables_country_year(root=root)
    source_coverage = summarize_step3_sources(
        _versions(root=root),
        root=root,
        missing=missing,
    )
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
        "source_coverage": source_coverage,
        "product_partitions": product["partitions"],
        "missing_sources": missing,
    }
