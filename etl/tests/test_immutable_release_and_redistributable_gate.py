"""P0: immutable version trees + variable redistributable gate for public."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from imsatlas_etl.pipeline.promote import promote_release
from imsatlas_etl.pipeline.release import _variable_gates, run_release

# Public v1.3.0 had these verified+ship but redistributable:false (catalog).
BLOCKED_PUBLIC_IDS = frozenset(
    {"PPAD", "CIBC", "LPIN", "CPTR", "CLI", "INAN", "UNRA", "INRI", "CPIN"}
)


def test_public_gates_exclude_redistributable_false() -> None:
    rows = {r["id"]: r for r in _variable_gates(audience="public")}
    for vid in BLOCKED_PUBLIC_IDS:
        assert vid in rows, f"missing catalog row {vid}"
        assert rows[vid]["included"] is False
        reasons = " ".join(rows[vid].get("reasons") or [])
        assert "redistributable=false" in reasons


def test_internal_gates_not_bound_by_redistributable_flag() -> None:
    """Internal audience ignores redistributable=false for inclusion."""
    pub = {r["id"]: r for r in _variable_gates(audience="public")}
    _ = {r["id"]: r for r in _variable_gates(audience="internal")}
    for vid in BLOCKED_PUBLIC_IDS:
        assert pub[vid]["included"] is False


def test_run_release_refuses_overwrite_even_with_force(
    world_root: Path,
    ship_cell_variables: frozenset[str],
) -> None:
    first = run_release(
        "0.2.0",
        root=world_root,
        staging=True,
        force=True,
        audience="public",
    )
    rel = Path(first["path"])
    marker = rel / "IMMUTABLE_MARKER.txt"
    marker.write_text("keep-me\n", encoding="utf-8")
    before = marker.read_text(encoding="utf-8")

    with pytest.raises(FileExistsError, match="refusing overwrite"):
        run_release(
            "0.2.0",
            root=world_root,
            staging=True,
            force=True,
            audience="public",
        )

    assert marker.is_file()
    assert marker.read_text(encoding="utf-8") == before
    assert ship_cell_variables  # fixture wired


def test_promote_refuses_overwrite_even_with_force(
    world_root: Path,
    ship_cell_variables: frozenset[str],
) -> None:
    run_release(
        "0.3.0",
        root=world_root,
        staging=True,
        force=True,
        audience="public",
    )
    promote_release(
        "0.3.0",
        by="Tester",
        root=world_root,
        force=True,
        audience="public",
    )
    dest = world_root / "data" / "release" / "public" / "v0.3.0"
    assert dest.is_dir()
    (dest / "KEEP.txt").write_text("x\n", encoding="utf-8")

    # Staging still present from first release; promote again must refuse.
    with pytest.raises(FileExistsError, match="refusing overwrite"):
        promote_release(
            "0.3.0",
            by="Tester",
            root=world_root,
            force=True,
            audience="public",
        )
    assert (dest / "KEEP.txt").read_text(encoding="utf-8") == "x\n"
    assert ship_cell_variables


def test_second_release_ok_after_manual_delete(
    world_root: Path,
    ship_cell_variables: frozenset[str],
) -> None:
    run_release(
        "0.4.0",
        root=world_root,
        staging=True,
        force=True,
        audience="public",
    )
    dest = world_root / "data" / "release" / "staging" / "v0.4.0"
    shutil.rmtree(dest)
    second = run_release(
        "0.4.0",
        root=world_root,
        staging=True,
        force=True,
        audience="public",
    )
    assert Path(second["path"]).is_dir()
    man_path = Path(second["path"]) / "manifest.json"
    man = json.loads(man_path.read_text(encoding="utf-8"))
    assert man["version"] == "0.4.0"
    assert ship_cell_variables
