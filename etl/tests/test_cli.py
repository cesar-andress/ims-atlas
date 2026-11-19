from typer.testing import CliRunner

from imsatlas_etl.cli import app

runner = CliRunner()


def test_catalog_validate_ok() -> None:
    result = runner.invoke(app, ["catalog-validate", "--no-write-licenses"])
    assert result.exit_code == 0
    assert "catalog-validate ok" in result.stdout


def test_build_scaffold() -> None:
    result = runner.invoke(app, ["build"])
    assert result.exit_code == 0
    assert "build" in result.stdout


def test_release_scaffold() -> None:
    result = runner.invoke(app, ["release"])
    assert result.exit_code == 0
    assert "release" in result.stdout
