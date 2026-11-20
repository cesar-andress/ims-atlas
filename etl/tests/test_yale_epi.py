"""Yale EPI workbook parse (fixture bytes, no network)."""

from __future__ import annotations

from pathlib import Path

from imsatlas_etl.connectors import yale_epi

FIX = Path(__file__).parent / "fixtures" / "yale_epi" / "epi2026_sample.xlsx"


def test_parse_workbook_keeps_iso_and_epi() -> None:
    body = FIX.read_bytes()
    table, counts = yale_epi.parse_workbook(body, 2026)
    assert counts["n_kept"] == 3
    assert set(table.columns) == {"iso3", "year", "value"}
    assert table.iloc[0]["iso3"] == "AFG"
    assert table.iloc[0]["year"] == 2026
    assert float(table.iloc[0]["value"]) == 33.14
