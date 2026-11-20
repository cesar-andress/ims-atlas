from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from typer.testing import CliRunner

from imsatlas_etl.catalog import (
    CatalogValidationError,
    assert_valid_catalog,
    load_catalog,
    load_schema,
    render_licenses_md,
    validate_catalog,
)
from imsatlas_etl.cli import app
from imsatlas_etl.paths import catalog_dir, repo_root
from imsatlas_etl.port_catalog import build_catalog_from_backtest

runner = CliRunner()
FIXTURES = Path(__file__).parent / "fixtures"


def test_schema_file_exists() -> None:
    assert (catalog_dir() / "schema.json").is_file()
    schema = load_schema()
    assert "variables" in schema["properties"]


def test_catalog_yaml_validates() -> None:
    data = load_catalog()
    errors = validate_catalog(data)
    assert errors == []
    assert_valid_catalog(data)


def test_catalog_has_eighteen_ported_and_status_mix() -> None:
    data = load_catalog()
    ids = [v["id"] for v in data["variables"]]
    ported = {
        "IMPV",
        "IMPC",
        "GRW",
        "GDPPC",
        "DIST",
        "TARIF",
        "FTA",
        "LPI",
        "ASIASH",
        "HHI",
        "UVGAP",
        "CULT",
        "LANG",
        "INFL",
        "UNEMP",
        "GOV",
        "EOC",
        "REEXP",
    }
    assert ported.issubset(set(ids))
    assert len(ported) == 18
    for catalog_id in (
        "ITU_IDI",
        "EF_EPI",
        "ODIN",
        "GEDI",
        "GII",
        "STARTUPBLINK",
        "EPI",
        "CO2PC",
        "PLI",
    ):
        assert catalog_id in ids
    by_status = {v["id"]: v["status"] for v in data["variables"]}
    assert by_status["GDPPC"] == "verified"
    assert by_status["GII"] == "verified"
    assert by_status["CO2PC"] == "verified"
    assert by_status["PLI"] == "verified"
    assert by_status["TARIF"] == "draft"
    assert by_status["CULT"] == "draft"
    assert by_status["ITU_IDI"] == "draft"
    assert sum(1 for s in by_status.values() if s == "verified") == 28
    assert sum(1 for s in by_status.values() if s == "draft") == 23
    openness = [v for v in data["variables"] if v["id"] in {"EOC", "REEXP"}]
    assert all(v["factor"] == "openness" for v in openness)


def test_broken_fixture_rejected() -> None:
    path = FIXTURES / "catalog_broken.yaml"
    broken = yaml.safe_load(path.read_text(encoding="utf-8"))
    errors = validate_catalog(broken, schema=load_schema())
    assert errors
    with pytest.raises(CatalogValidationError):
        assert_valid_catalog(broken, schema=load_schema())


def test_redistributable_false_requires_byod() -> None:
    data = load_catalog()
    sample = next(v for v in data["variables"] if v["redistributable"] is False)
    bad = yaml.safe_load(yaml.safe_dump(data))
    for var in bad["variables"]:
        if var["id"] == sample["id"]:
            var.pop("byod_only", None)
            break
    errors = validate_catalog(bad)
    assert any("byod_only" in err for err in errors)


def test_licenses_md_render_contains_table() -> None:
    data = load_catalog()
    md = render_licenses_md(data)
    assert "| Variable | source_ids | Licence(s) |" in md
    assert "IMPV" in md
    licenses_path = catalog_dir() / "LICENSES.md"
    assert licenses_path.is_file()
    assert "IMPV" in licenses_path.read_text(encoding="utf-8")


def test_cli_catalog_validate() -> None:
    result = runner.invoke(app, ["catalog-validate", "--no-write-licenses"])
    assert result.exit_code == 0, result.stdout + result.stderr
    assert "catalog-validate ok" in result.stdout


def test_port_from_pinned_imsfe_matches_committed_ids() -> None:
    """Requires imsfe extra + uv git checkout; skips if checkout missing."""
    try:
        built = build_catalog_from_backtest()
    except FileNotFoundError:
        pytest.skip("imsfe checkout / variables.yaml not available")
    committed = load_catalog()
    built_ids = [v["id"] for v in built["variables"]]
    committed_ids = [v["id"] for v in committed["variables"]]
    # Pinned imsfe port remains the prefix; Phase J may append Jose-code drafts.
    assert committed_ids[: len(built_ids)] == built_ids
    assert (repo_root() / "catalog" / "variables.yaml").is_file()
