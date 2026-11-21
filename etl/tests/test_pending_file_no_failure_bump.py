"""pending_file / no_connector must not inflate consecutive_failures."""

from __future__ import annotations

from pathlib import Path

from imsatlas_etl.pipeline.sources_state import mark_check


def test_pending_file_does_not_bump_failures(tmp_path: Path) -> None:
    root = tmp_path
    (root / "status").mkdir()
    first = mark_check(
        "itu_datahub",
        root=root,
        ok=False,
        status="pending_file",
        error="falta fichero",
    )
    assert first["consecutive_failures"] == 0
    second = mark_check(
        "itu_datahub",
        root=root,
        ok=False,
        status="pending_file",
        error="falta fichero",
    )
    assert second["consecutive_failures"] == 0
    assert second["status"] == "pending_file"


def test_real_fail_still_bumps(tmp_path: Path) -> None:
    root = tmp_path
    (root / "status").mkdir()
    mark_check("baci", root=root, ok=False, status="fail", error="boom")
    third = mark_check("baci", root=root, ok=False, status="fail", error="boom")
    assert third["consecutive_failures"] == 2
