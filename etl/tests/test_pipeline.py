from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from imsatlas_etl.pipeline.check import run_check
from imsatlas_etl.pipeline.io_paths import PIPELINE_SOURCES, curated_dir, freshness_path
from imsatlas_etl.pipeline.runner import run_pipeline
from imsatlas_etl.pipeline.transform import (
    build_bilateral_year,
    build_country_year,
    build_trade_tables,
)
from imsatlas_etl.pipeline.validate import run_validate

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


@pytest.fixture()
def work_root(tmp_path: Path) -> Path:
    return tmp_path


def test_offline_pipeline_exact_curated(work_root: Path) -> None:
    log = run_pipeline(
        fixture_root=FIXTURE_ROOT,
        root=work_root,
        force=True,
    )
    assert log["status"] == "ok"
    assert "check" in log["steps"]
    assert "extract" in log["steps"]
    assert "validate" in log["steps"]
    assert "transform" in log["steps"]

    freshness = json.loads(freshness_path(root=work_root).read_text(encoding="utf-8"))
    assert len(freshness["sources"]) == len(PIPELINE_SOURCES)
    assert all(row["upstream_version"] == "mini-2022" for row in freshness["sources"])

    country = pd.read_parquet(curated_dir(root=work_root) / "country_year.parquet")
    bilateral = pd.read_parquet(curated_dir(root=work_root) / "bilateral_year.parquet")
    hs2 = pd.read_parquet(curated_dir(root=work_root) / "trade_hs2.parquet")
    hs4 = pd.read_parquet(curated_dir(root=work_root) / "trade_hs4.parquet")
    variables = pd.read_parquet(
        curated_dir(root=work_root) / "variables_country_year.parquet",
    )

    counts = log["steps"]["transform"]["row_counts"]
    assert counts["country_year"] == 9
    assert counts["bilateral_year"] == 18
    assert counts["trade_hs2"] == 36
    assert counts["trade_hs4"] == 36
    assert counts["trade_hs6"] == 36
    assert counts["variables_country_year"] == 9
    assert {"CO2PC", "PLI", "ITU_IDI", "GII"}.issubset(set(variables.columns))
    assert len(country) == 9
    assert set(country["iso3"]) == {"ESP", "MEX", "CHL"}
    assert set(country["year"]) == {2020, 2021, 2022}
    esp_2022 = country[(country["iso3"] == "ESP") & (country["year"] == 2022)].iloc[0]
    assert float(esp_2022["NY.GDP.PCAP.PP.KD"]) == 40000.0
    assert float(esp_2022["SP.POP.TOTL"]) == 47400000.0
    assert float(esp_2022["LP.LPI.OVRL.XQ"]) == 3.8
    assert float(esp_2022["pdi"]) == 57.0

    assert len(bilateral) == 18
    pair = bilateral[
        (bilateral["origin"] == "ESP")
        & (bilateral["destination"] == "MEX")
        & (bilateral["year"] == 2022)
    ].iloc[0]
    assert float(pair["distw"]) == 9000.0
    assert int(pair["comlang_off"]) == 1
    assert pair["ahs_mean"] == pytest.approx(9.5)

    assert len(hs2) == 36
    assert len(hs4) == 36
    hs6_parts = list(
        (curated_dir(root=work_root) / "trade_hs6").glob("hs4=*/part.parquet"),
    )
    assert len(hs6_parts) == 2


def test_transform_unit_country_year(work_root: Path) -> None:
    run_pipeline(fixture_root=FIXTURE_ROOT, root=work_root, force=True)
    country = build_country_year(root=work_root)
    assert country.shape[0] == 9
    assert "CC.EST" in country.columns
    assert "idv" in country.columns


def test_validate_fails_on_broken_iso(work_root: Path) -> None:
    run_pipeline(
        steps=["check", "extract"],
        fixture_root=FIXTURE_ROOT,
        root=work_root,
        force=True,
    )
    # Corrupt a raw file
    path = work_root / "data" / "raw" / "worldbank_wdi" / "mini-2022" / "indicators.csv"
    text = path.read_text(encoding="utf-8")
    path.write_text(text.replace("ESP", "ES", 1), encoding="utf-8")
    with pytest.raises(ValueError, match="validate failed"):
        run_validate(sources=["worldbank_wdi"], root=work_root)


def test_check_marks_stale_when_not_ingested(work_root: Path) -> None:
    rows = run_check(fixture_root=FIXTURE_ROOT, root=work_root)
    assert all(r["stale"] for r in rows)
    run_pipeline(fixture_root=FIXTURE_ROOT, root=work_root, force=True)
    rows2 = run_check(fixture_root=FIXTURE_ROOT, root=work_root)
    assert all(not r["stale"] for r in rows2)


def test_bilateral_and_trade_builders(work_root: Path) -> None:
    run_pipeline(fixture_root=FIXTURE_ROOT, root=work_root, force=True)
    bil = build_bilateral_year(root=work_root)
    trades = build_trade_tables(root=work_root)
    assert bil["ahs_mean"].notna().all()
    assert trades["trade_hs6"]["hs6"].isin(["870323", "847130"]).all()
