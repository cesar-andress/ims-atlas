"""Live-mode DAG and CLI exit codes with the network layer replaced (no network)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest
from typer.testing import CliRunner

from imsatlas_etl.cli import app
from imsatlas_etl.connectors.http import SourceUnavailableError
from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline import check as check_mod
from imsatlas_etl.pipeline import extract as extract_mod
from imsatlas_etl.pipeline import runner as runner_mod
from imsatlas_etl.pipeline.io_paths import PIPELINE_SOURCES
from imsatlas_etl.pipeline.runner import run_pipeline

runner = CliRunner()
FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


@pytest.fixture()
def live_stubs(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Replace probe + live extract with fixture-backed stand-ins (mode=live)."""
    # Lineage/QA read catalog/ and config/ relative to the (overridden) root.
    for name in ("catalog", "config"):
        shutil.copytree(repo_root() / name, tmp_path / name)
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))

    def probe(source_id: str, *, root: Path | None) -> dict[str, Any]:
        return {"upstream_version": "live-2024-01-15", "note": "stub probe"}

    def live(
        source_id: str,
        version: str,
        *,
        root: Path | None,
        force: bool,
    ) -> dict[str, Any]:
        res = extract_mod._extract_fixture(
            source_id,
            version,
            fixture_root=FIXTURE_ROOT,
            root=root,
            force=force,
        )
        res["rows"] = 1
        meta_path = Path(res["path"] + ".meta.json")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["mode"] = "live"  # the stand-in plays the role of a live extract
        meta_path.write_text(json.dumps(meta), encoding="utf-8")
        return res

    monkeypatch.setattr(check_mod, "_live_probe", probe)
    monkeypatch.setattr(extract_mod, "_extract_live", live)
    return tmp_path


def test_live_run_records_mode_history_changes_and_runs_qa_lineage(
    live_stubs: Path,
) -> None:
    log = run_pipeline(root=live_stubs, force=True)
    assert log["mode"] == "live" and log["is_fixture"] is False
    assert log["status"] == "ok"
    assert list(log["steps"]) == [
        "check",
        "extract",
        "validate",
        "transform",
        "qa",
        "lineage",
        "stores",
    ]
    assert log["steps"]["qa"]["report_status"] in {"pass", "warn"}
    assert (live_stubs / "status" / "lineage.json").is_file()
    assert (live_stubs / "status" / "qa.json").is_file()

    freshness = json.loads((live_stubs / "status/freshness.json").read_text())
    assert freshness["mode"] == "live" and freshness["is_fixture"] is False
    assert {r["mode"] for r in freshness["sources"]} == {"live"}

    history = (live_stubs / "status/history.jsonl").read_text().splitlines()
    assert len(history) == 1
    entry = json.loads(history[0])
    assert entry["mode"] == "live" and entry["status"] == "ok"
    assert len(entry["ingested"]) == len(PIPELINE_SOURCES)
    changes = json.loads(
        (live_stubs / f"status/changes/{log['run_id']}.json").read_text()
    )
    assert changes["mode"] == "live"
    assert {v["status"] for v in changes["sources"].values()} == {"first_ingest"}


def test_second_live_run_skips_existing_and_appends_history(live_stubs: Path) -> None:
    run_pipeline(root=live_stubs, force=True)
    again = run_pipeline(root=live_stubs)
    lines = (live_stubs / "status/history.jsonl").read_text().splitlines()
    assert len(lines) == 2
    assert json.loads(lines[1])["ingested"] == []
    assert again["status"] == "ok"


def test_fixture_run_is_labelled_fixture(tmp_path: Path) -> None:
    log = run_pipeline(fixture_root=FIXTURE_ROOT, root=tmp_path, force=True)
    assert log["mode"] == "fixture" and log["is_fixture"] is True
    assert "qa" not in log["steps"]  # fixture default DAG is unchanged
    freshness = json.loads((tmp_path / "status/freshness.json").read_text())
    assert freshness["mode"] == "fixture" and freshness["is_fixture"] is True
    entry = json.loads((tmp_path / "status/history.jsonl").read_text().splitlines()[0])
    assert entry["mode"] == "fixture"


def test_cli_run_live_ok_exit_0(live_stubs: Path) -> None:
    result = runner.invoke(app, ["run", "--live", "--force"])
    assert result.exit_code == 0, result.stdout + result.stderr
    assert "mode=live" in result.stdout


def test_cli_run_live_source_unreachable_exit_2(
    live_stubs: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(source_id: str, *, root: Path | None) -> dict[str, Any]:
        raise SourceUnavailableError("GET failed for 'https://example.invalid'")

    monkeypatch.setattr(check_mod, "_live_probe", boom)
    result = runner.invoke(app, ["run", "--live"])
    assert result.exit_code == 2
    assert "GET failed" in result.stderr
    # The failed run is still logged for the audit trail.
    entry = json.loads(
        (live_stubs / "status/history.jsonl").read_text().splitlines()[0]
    )
    assert entry["status"] == "failed"


def test_cli_run_live_qa_block_exit_1(
    live_stubs: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def failing_qa(*, root: Path | None = None) -> dict[str, Any]:
        return {"status": "fail", "n_block": 1, "n_warn": 0}

    monkeypatch.setattr(runner_mod, "run_qa", failing_qa)
    result = runner.invoke(app, ["run", "--live", "--force"])
    assert result.exit_code == 1
    assert "QA blocked" in result.stderr
    entry = json.loads(
        (live_stubs / "status/history.jsonl").read_text().splitlines()[0]
    )
    assert entry["status"] == "qa_blocked" and entry["qa_status"] == "fail"
    assert (live_stubs / "status/lineage.json").is_file()  # lineage still written


def test_cli_run_requires_a_mode(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))
    assert runner.invoke(app, ["run"]).exit_code == 1
    both = runner.invoke(app, ["run", "--live", "--fixture-root", str(FIXTURE_ROOT)])
    assert both.exit_code == 1


def test_cli_run_fixture_mode_exit_0(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))
    result = runner.invoke(
        app,
        ["run", "--fixture-root", str(FIXTURE_ROOT), "--force"],
    )
    assert result.exit_code == 0, result.stdout + result.stderr
    assert "mode=fixture" in result.stdout


def test_cli_check_live_without_manual_files_soft_ok(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """EXTRA-4: missing manual drop is reported, not a hard failure."""
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))
    result = runner.invoke(app, ["check", "--source", "hofstede"])
    assert result.exit_code == 0, result.stdout + result.stderr
    freshness = json.loads((tmp_path / "status/freshness.json").read_text())
    row = next(r for r in freshness["sources"] if r["source"] == "hofstede")
    assert row["status"] == "falta fichero (manual)"


def test_cli_extract_live_without_manual_files_records_missing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Partial live extract soft-fails missing drops (STEP 1); does not abort."""
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))
    drop = tmp_path / "data/manual/hofstede/dimensions.csv"
    drop.parent.mkdir(parents=True)
    drop.write_bytes((FIXTURE_ROOT / "hofstede/dimensions.csv").read_bytes())
    ok = runner.invoke(app, ["check", "--source", "hofstede"])
    assert ok.exit_code == 0, ok.stdout + ok.stderr
    done = runner.invoke(app, ["extract", "--source", "hofstede"])
    assert done.exit_code == 0, done.stdout + done.stderr
    drop.unlink()
    (tmp_path / "data/raw/hofstede").rename(tmp_path / "raw_moved")
    missing = runner.invoke(app, ["extract", "--source", "hofstede"])
    assert missing.exit_code == 0, missing.stdout + missing.stderr
    combined = (missing.stdout + missing.stderr).lower()
    assert "extract ok" in combined or "missing" in combined


def test_live_check_ignores_fixture_raw_versions(live_stubs: Path) -> None:
    from imsatlas_etl.pipeline.io_paths import PIPELINE_SOURCES

    run_pipeline(fixture_root=FIXTURE_ROOT, root=live_stubs, force=True)
    rows = check_mod.run_check(root=live_stubs)
    core = [r for r in rows if r["source"] in PIPELINE_SOURCES]
    assert all(r["ingested_version"] is None and r["stale"] for r in core)
    run_pipeline(root=live_stubs, force=True)
    rows = check_mod.run_check(root=live_stubs)
    core = [r for r in rows if r["source"] in PIPELINE_SOURCES]
    assert all(r["ingested_version"] == "live-2024-01-15" for r in core)
    assert all(not r["stale"] for r in core)
