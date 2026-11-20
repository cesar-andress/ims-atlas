from __future__ import annotations

import json

import pytest
import yaml
from typer.testing import CliRunner

from imsatlas_etl.catalog import load_catalog, validate_catalog
from imsatlas_etl.cli import app
from imsatlas_etl.paths import catalog_yaml_path
from imsatlas_etl.verify import verify_variable
from imsatlas_etl.wb_indicators import (
    assert_fixture_matches_code,
    fixture_path,
    load_indicator_fixture,
    seed_fixtures_from_catalog_metadata,
    world_bank_codes_from_catalog,
    write_minimal_fixture,
)

runner = CliRunner()


@pytest.fixture(scope="module", autouse=True)
def _seed_wb_fixtures() -> None:
    seed_fixtures_from_catalog_metadata()


def test_every_catalog_wb_code_has_matching_fixture() -> None:
    codes = world_bank_codes_from_catalog()
    assert "EN.GHG.CO2.PC.CE.AR5" in codes
    assert "EN.ATM.CO2E.PC" not in codes
    assert codes
    for code in codes:
        payload = load_indicator_fixture(code)
        assert_fixture_matches_code(code, payload)
        assert fixture_path(code).is_file()


def test_unknown_schema_key_rejected() -> None:
    data = yaml.safe_load(catalog_yaml_path().read_text(encoding="utf-8"))
    data["variables"][0]["not_in_schema"] = True
    errors = validate_catalog(data)
    assert any("Additional properties" in err for err in errors)


def test_fixture_id_mismatch_detected() -> None:
    code = "NY.GDP.PCAP.PP.KD"
    path = write_minimal_fixture(
        code,
        name="GDP per capita",
        source_value="World Development Indicators",
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["id"] = "WRONG.CODE"
    with pytest.raises(AssertionError, match="fixture id"):
        assert_fixture_matches_code(code, payload)
    # Restore fixtures for other tests.
    seed_fixtures_from_catalog_metadata()
    assert path.is_file()


def test_verify_sets_status_on_copy(tmp_path) -> None:  # type: ignore[no-untyped-def]
    src = catalog_yaml_path()
    dest = tmp_path / "variables.yaml"
    dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    result = verify_variable(
        "GDPPC",
        by="Test Human",
        on="2026-11-19",
        catalog_path=dest,
    )
    assert result["status"] == "verified"
    data = yaml.safe_load(dest.read_text(encoding="utf-8"))
    gdppc = next(v for v in data["variables"] if v["id"] == "GDPPC")
    assert gdppc["status"] == "verified"
    assert gdppc["verified_by"] == "Test Human"
    assert gdppc["verified_on"] == "2026-11-19"
    committed = load_catalog()
    committed_gdppc = next(v for v in committed["variables"] if v["id"] == "GDPPC")
    assert committed_gdppc["status"] == "verified"
    # Copy-only mutate: committed provenance must stay distinct from the test byline.
    assert committed_gdppc.get("verified_by") != "Test Human"


def test_cli_verify_rejects_empty_by() -> None:
    result = runner.invoke(app, ["verify", "GDPPC", "--by", "  "])
    assert result.exit_code != 0
