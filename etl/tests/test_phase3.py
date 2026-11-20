from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from imsatlas_etl.iso3 import map_country_column, map_country_name
from imsatlas_etl.pipeline.coverage import run_coverage_reports
from imsatlas_etl.pipeline.io_paths import curated_dir, status_root
from imsatlas_etl.pipeline.phase3_report import write_phase3_report
from imsatlas_etl.pipeline.release import run_release
from imsatlas_etl.pipeline.runner import run_pipeline

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


def test_iso3_explicit_map_no_fuzzy() -> None:
    assert map_country_name("Spain") == "ESP"
    assert map_country_name("España") == "ESP"
    assert map_country_name("Unknownland") is None
    frame = pd.DataFrame(
        {
            "country_name": ["Spain", "Narnia", "Chile"],
            "year": [2020, 2020, 2020],
            "value": [1.0, 2.0, 3.0],
        },
    )
    mapped, unmatched = map_country_column(frame)
    assert list(mapped["iso3"]) == ["ESP", "CHL"]
    assert len(unmatched) == 1
    assert unmatched[0]["country_name"] == "Narnia"


@pytest.fixture()
def phase3_root(tmp_path: Path) -> Path:
    run_pipeline(fixture_root=FIXTURE_ROOT, root=tmp_path, force=True)
    return tmp_path


def test_phase3_variables_and_coverage(phase3_root: Path) -> None:
    vars_path = curated_dir(root=phase3_root) / "variables_country_year.parquet"
    assert vars_path.is_file()
    frame = pd.read_parquet(vars_path)
    assert float(
        frame[(frame["iso3"] == "ESP") & (frame["year"] == 2022)]["CO2PC"].iloc[0],
    ) == pytest.approx(4.9)
    assert float(
        frame[(frame["iso3"] == "ESP") & (frame["year"] == 2022)]["PLI"].iloc[0],
    ) == pytest.approx(82.0)
    assert "ITU_IDI" in frame.columns
    assert "EPI" in frame.columns

    cov = run_coverage_reports(root=phase3_root)
    assert (status_root(root=phase3_root) / "coverage" / "CO2PC_coverage.csv").is_file()
    assert (status_root(root=phase3_root) / "coverage" / "CO2PC_coverage.png").is_file()
    assert all(r["status"] == "ok" for r in cov["reports"])

    report = write_phase3_report(root=phase3_root)
    text = report.read_text(encoding="utf-8")
    assert "ITU_IDI" in text
    assert "BYOD" in text


def test_release_strips_byod_variable_ids(
    phase3_root: Path, no_ship_gate: None
) -> None:
    result = run_release("0.1.0", root=phase3_root, staging=True, force=True)
    root = Path(result["path"])
    country = pd.read_parquet(root / "country_year.parquet")
    assert list(country.columns) == [
        "iso3",
        "year",
        "variable_id",
        "value",
        "flag_imputed",
        "flag_locf",
    ]
    # Gate still BYOD → empty long table (no shipped variable_id values)
    assert len(country) == 0
    assert (root / "catalog.json").is_file()
    assert (root / "trade" / "hs2=_empty" / "part.parquet").is_file()
