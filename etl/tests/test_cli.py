from pathlib import Path

import pytest
from typer.testing import CliRunner

from imsatlas_etl.cli import app

runner = CliRunner()
FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


def test_catalog_validate_ok() -> None:
    result = runner.invoke(app, ["catalog-validate", "--no-write-licenses"])
    assert result.exit_code == 0
    assert "catalog-validate ok" in result.stdout


def test_build_requires_fixture_or_runs_offline(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    missing = runner.invoke(app, ["build"])
    assert missing.exit_code == 1
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))
    result = runner.invoke(
        app,
        [
            "build",
            "--fixture-root",
            str(FIXTURE_ROOT),
            "--force",
        ],
    )
    assert result.exit_code == 0, result.stdout + result.stderr
    assert "run ok" in result.stdout


def test_release_scaffold() -> None:
    result = runner.invoke(app, ["release"])
    assert result.exit_code == 0
    assert "release" in result.stdout
