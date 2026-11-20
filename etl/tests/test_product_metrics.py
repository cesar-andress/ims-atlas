"""BACI country×product metrics (Phase H)."""

from __future__ import annotations

import json

import pandas as pd

from imsatlas_etl.pipeline.product_metrics import (
    compute_product_metrics,
    write_product_metrics_partitioned,
)


def _toy_trade() -> pd.DataFrame:
    # Two suppliers into MEX for HS 870323; CHN dominates → high ASIASH/HHI.
    return pd.DataFrame(
        [
            {
                "year": 2020,
                "exporter": "CHN",
                "importer": "MEX",
                "hs6": "870323",
                "value_usd": 80.0,
            },
            {
                "year": 2020,
                "exporter": "DEU",
                "importer": "MEX",
                "hs6": "870323",
                "value_usd": 20.0,
            },
            {
                "year": 2020,
                "exporter": "MEX",
                "importer": "USA",
                "hs6": "870323",
                "value_usd": 10.0,
            },
            {
                "year": 2023,
                "exporter": "CHN",
                "importer": "MEX",
                "hs6": "870323",
                "value_usd": 160.0,
            },
            {
                "year": 2023,
                "exporter": "DEU",
                "importer": "MEX",
                "hs6": "870323",
                "value_usd": 40.0,
            },
        ],
    )


def test_compute_impv_hhi_asiash_reexp() -> None:
    metrics = compute_product_metrics(_toy_trade())
    mex_2020 = metrics[
        (metrics.iso3 == "MEX")
        & (metrics.year == 2020)
        & (metrics.hs_code == "870323")
        & (metrics.hs_level == "hs6")
    ]
    by_var = {r.variable_id: r.value for r in mex_2020.itertuples(index=False)}
    assert by_var["IMPV"] == 100.0
    assert abs(by_var["ASIASH"] - 0.8) < 1e-12
    assert abs(by_var["HHI"] - (0.8**2 + 0.2**2)) < 1e-12
    # MEX exports 10 to USA vs imports 100 → reexp 0.1
    assert abs(by_var["REEXP"] - 0.1) < 1e-12


def test_grw_uses_t_minus_3() -> None:
    metrics = compute_product_metrics(_toy_trade())
    mex_2023 = metrics[
        (metrics.iso3 == "MEX")
        & (metrics.year == 2023)
        & (metrics.hs_code == "87")
        & (metrics.hs_level == "hs2")
        & (metrics.variable_id == "GRW")
    ]
    assert len(mex_2023) == 1
    # 100 -> 200 over 3 years: (2)^(1/3) - 1
    expected = 2.0 ** (1.0 / 3.0) - 1.0
    assert abs(float(mex_2023.iloc[0]["value"]) - expected) < 1e-12


def test_levels_hs2_hs4_hs6() -> None:
    metrics = compute_product_metrics(_toy_trade())
    levels = set(metrics["hs_level"].unique())
    assert levels == {"hs2", "hs4", "hs6"}
    assert "87" in set(metrics.loc[metrics.hs_level == "hs2", "hs_code"])
    assert "8703" in set(metrics.loc[metrics.hs_level == "hs4", "hs_code"])


def test_partition_write(tmp_path) -> None:
    metrics = compute_product_metrics(_toy_trade())
    meta = write_product_metrics_partitioned(metrics, tmp_path / "country_product")
    assert meta["rows"] == len(metrics)
    assert (tmp_path / "country_product" / "hs2=87" / "part.parquet").is_file()
    part = pd.read_parquet(tmp_path / "country_product" / "hs2=87" / "part.parquet")
    assert set(part["hs2"].unique()) == {"87"}


def test_partition_write_fine_budget(tmp_path) -> None:
    metrics = compute_product_metrics(_toy_trade())
    meta = write_product_metrics_partitioned(
        metrics,
        tmp_path / "country_product",
        max_file_bytes=5 * 1024 * 1024,
    )
    assert meta["rows"] == len(metrics)
    index = tmp_path / "country_product" / "hs2=87" / "index.json"
    assert index.is_file()
    payload = json.loads(index.read_text(encoding="utf-8"))
    assert payload["parts"]
    part = tmp_path / "country_product" / "hs2=87" / payload["parts"][0]
    assert part.is_file()
    frame = pd.read_parquet(part)
    assert set(frame["hs2"].unique()) == {"87"}
