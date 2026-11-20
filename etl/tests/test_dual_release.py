"""Phase R: dual public/internal staging audiences."""

from __future__ import annotations

import json
from pathlib import Path

from imsatlas_etl.pipeline.io_paths import (
    staging_internal_release_dir,
    staging_release_dir,
)
from imsatlas_etl.pipeline.promote import promote_release
from imsatlas_etl.pipeline.release import run_release, write_dual_release_report


def test_public_and_internal_staging_paths(
    world_root: Path,
    no_ship_gate: None,
    ship_cell_variables: frozenset[str],
) -> None:
    pub = run_release(
        "1.1.0",
        root=world_root,
        staging=True,
        force=True,
        audience="public",
    )
    assert Path(pub["path"]) == staging_release_dir(root=world_root) / "v1.1.0"
    assert pub["audience"] == "public"
    assert pub["n_included_variables"] == len(ship_cell_variables)

    internal = run_release(
        "1.1.0",
        root=world_root,
        staging=True,
        force=True,
        audience="internal",
    )
    assert (
        Path(internal["path"])
        == staging_internal_release_dir(root=world_root) / "v1.1.0"
    )
    assert internal["audience"] == "internal"
    assert (Path(internal["path"]) / "manifest.json").is_file()


def test_dual_report_and_internal_promote(world_root: Path) -> None:
    pub = run_release(
        "1.1.0",
        root=world_root,
        staging=True,
        force=True,
        audience="public",
    )
    internal = run_release(
        "1.1.0",
        root=world_root,
        staging=True,
        force=True,
        audience="internal",
    )
    report = write_dual_release_report(
        "1.1.0",
        public_result=pub,
        internal_result=internal,
        root=world_root,
    )
    text = report.read_text(encoding="utf-8")
    assert "Public audience" in text
    assert "Internal audience" in text
    assert "Human gate" in text

    promoted = promote_release(
        "1.1.0",
        by="test",
        root=world_root,
        force=True,
        audience="internal",
    )
    assert promoted["audience"] == "internal"
    manifest = json.loads(
        (Path(promoted["path"]) / "manifest.json").read_text(encoding="utf-8"),
    )
    assert manifest["staging"] is False
    assert manifest["audience"] == "internal"
