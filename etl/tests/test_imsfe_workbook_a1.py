"""Phase A1: IMSFE workbook reader — anonymity + gated golden scores."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from openpyxl import Workbook

from imsatlas_etl.imsfe_workbook import (
    assert_no_personal_names,
    read_imsfe_workbook,
)

FOOTWEAR_ENV = "IMSFE_WORKBOOK_PATH"
OIL_ENV = "IMSFEM_WORKBOOK_PATH"

FOOTWEAR_GOLDEN = {
    "Switzerland": 6.1193342709,
    "Singapore": 5.8123308293,
    "Germany": 4.7428192560,
}
OIL_GOLDEN = {
    "Switzerland": 6.7840593763,
    "Denmark": 6.5162640188,
    "Russia": 3.0865432753,
}


def _write_mini_workbook(path: Path, *, with_names: bool) -> None:
    """Minimal IMSFE-shaped workbook for anonymity / structure tests."""
    wb = Workbook()
    # Sheet 1 — experts
    ws1 = wb.active
    ws1.title = "1. Total Average for criteria"
    ws1["B2"] = "14 Empresarios del sector" if not with_names else None
    ws1["B5"] = "N. Respondents"
    ws1["C5"] = "Cost (COST)"
    if with_names:
        ws1["A6"] = 1
        ws1["B6"] = "Professor 1 Daniel Bonilla Calle DONE"
        ws1["C6"] = 0.25
        ws1["A7"] = 2
        ws1["B7"] = "Professor 2 Félix Barahona Márquez DONE"
        ws1["C7"] = 0.2
        ws1["B8"] = "Total average"
        ws1["C8"] = 0.225
    else:
        ws1["A6"] = 1
        ws1["B6"] = "Respondent 1"
        ws1["C6"] = 0.2325
        ws1["B7"] = "Total average"
        ws1["C7"] = 0.2325

    ws2 = wb.create_sheet("2. Weights % and sources")
    ws2["C2"] = "Factor"
    ws2["D2"] = "%"
    ws2["F2"] = "Variables"
    ws2["G2"] = "%"
    ws2["C3"] = "Cost (COST)"
    ws2["D3"] = 0.5
    ws2["F3"] = "Product Price at Destination (PPAD)"
    ws2["G3"] = 1.0
    ws2["C4"] = "Logistical (LOGI)"
    ws2["D4"] = 0.5
    ws2["F4"] = "Logistics Performance Index (LPIN)"
    ws2["G4"] = 1.0

    ws3 = wb.create_sheet("3. Standardization of criteria")
    ws3["A2"] = "10 Puntaje M"
    ws3["A3"] = 10
    ws3["B2"] = "Customs Code"
    ws3["B3"] = 64
    ws3["AD2"] = "Sum of exporter country: Colombia"
    ws3["E4"] = "Product Price at Destination (PPAD)"
    ws3["I4"] = "Logistics Performance Index (LPIN)"
    ws3["AC37"] = "Overall Score - TOTAL"
    ws3["D38"] = "Countries"
    ws3["E38"] = 1.0
    ws3["I38"] = 1.0
    ws3["D39"] = "Switzerland"
    ws3["E39"] = 8.0
    ws3["I39"] = 9.0
    ws3["AC39"] = 6.1193342709
    ws3["D40"] = "Singapore"
    ws3["E40"] = 7.0
    ws3["I40"] = 8.0
    ws3["AC40"] = 5.8123308293
    # Formulas for direction detection (point at raw block row 5)
    ws3["E5"] = 100
    ws3["I5"] = 4
    ws3["E39"] = "=($A$3*E5)/MAX($E$5:$E$5)"
    ws3["I39"] = "=($A$3*I5)/MAX($I$5:$I$5)"
    # Cached numeric values for data_only — openpyxl won't compute; set numbers
    # after formulas by writing a second pass via data_only=False only.
    # For mini fixture, put numeric scores in Overall col and leave formula cols
    # as numbers for data_only load by not using formulas for score cells.
    ws3["E39"] = 8.0
    ws3["I39"] = 9.0
    # Direction probe formulas on a nearby row the detector scans
    ws3["E41"] = "=($A$3*E5)/MAX($E$5:$E$5)"
    ws3["I41"] = "=($A$3*MIN($I$5:$I$5))/I5"

    wb.save(path)
    wb.close()


def test_fixture_with_names_never_leaks(tmp_path: Path) -> None:
    path = tmp_path / "named.xlsx"
    _write_mini_workbook(path, with_names=True)
    report = read_imsfe_workbook(path)
    assert_no_personal_names(report)
    assert report.expert_labels == ["Expert 1", "Expert 2"]
    assert report.n_experts == 2
    assert "Bonilla" not in str(report.to_dict())
    assert report.final_scores["Switzerland"] == pytest.approx(6.1193342709)
    assert report.origin == "Colombia"
    assert report.hs_code == "64"


def test_fixture_aggregated_respondent_warning(tmp_path: Path) -> None:
    path = tmp_path / "agg.xlsx"
    _write_mini_workbook(path, with_names=False)
    report = read_imsfe_workbook(path)
    assert_no_personal_names(report)
    assert report.n_experts == 1
    assert any("agregada" in w.lower() or "agregad" in w for w in report.warnings)


def _approx_match(got: float, expected: float, *, country: str, book: str) -> None:
    if abs(got - expected) > 1e-9:
        raise AssertionError(
            f"{book} {country}: got {got!r} expected {expected!r} "
            f"delta={got - expected!r}",
        )


@pytest.mark.skipif(
    not os.environ.get(FOOTWEAR_ENV),
    reason=f"set {FOOTWEAR_ENV} to run footwear golden",
)
def test_footwear_golden_scores() -> None:
    path = Path(os.environ[FOOTWEAR_ENV])
    report = read_imsfe_workbook(path)
    assert_no_personal_names(report)
    assert report.origin == "Colombia"
    assert report.hs_code == "64"
    assert report.n_criteria == 6
    assert report.n_variables == 18
    assert report.n_experts == 15
    for country, expected in FOOTWEAR_GOLDEN.items():
        assert country in report.final_scores, f"missing {country}"
        _approx_match(
            report.final_scores[country],
            expected,
            country=country,
            book="footwear",
        )
    assert report.variable_direction.get("INTC") == "IMP"
    assert report.variable_direction.get("LPIN") == "DMP"


@pytest.mark.skipif(
    not os.environ.get(OIL_ENV),
    reason=f"set {OIL_ENV} to run olive-oil golden",
)
def test_olive_oil_golden_scores() -> None:
    path = Path(os.environ[OIL_ENV])
    report = read_imsfe_workbook(path)
    assert_no_personal_names(report)
    assert report.origin == "Spain"
    assert report.hs_code == "15.09"
    assert report.n_criteria == 7
    assert report.n_variables == 21
    assert report.n_experts == 1
    assert any("agregada" in w.lower() for w in report.warnings)
    for country, expected in OIL_GOLDEN.items():
        assert country in report.final_scores, f"missing {country}"
        _approx_match(
            report.final_scores[country],
            expected,
            country=country,
            book="olive-oil",
        )
    assert "SUST" in report.criterion_weights
    assert report.variable_direction.get("RQBC") == "DMP"
    assert report.variable_direction.get("CADE") == "IMP"
