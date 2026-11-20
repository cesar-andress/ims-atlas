from __future__ import annotations

from pathlib import Path

import pytest

from imsatlas_etl.pipeline.promote import promote_release
from imsatlas_etl.pipeline.release import run_release
from imsatlas_etl.pipeline.reproduce import (
    diff_release_trees,
    reproduce_is_ok,
    reproduce_release,
)

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


def _public(world_root: Path) -> Path:
    run_release("0.1.0", root=world_root, staging=True, force=True)
    return Path(promote_release("0.1.0", by="Tester", root=world_root)["path"])


def test_fixture_world_reproduces_public_release(world_root: Path) -> None:
    ref = _public(world_root)
    result = reproduce_release("0.1.0", root=world_root, fixture_root=FIXTURE_ROOT)
    assert result["ok"] is True, result
    assert result["mode"] == "fixture"
    assert result["reference"] == str(ref)
    assert result["differing"] == [] and result["missing_in_candidate"] == []


def test_reproduce_from_curated_matches(world_root: Path) -> None:
    _public(world_root)
    result = reproduce_release("0.1.0", root=world_root)
    assert result["ok"] is True, result
    assert result["mode"] == "curated"


def test_reproduce_with_cells_matches(
    world_root: Path,
    ship_cell_variables: frozenset[str],
) -> None:
    _public(world_root)
    result = reproduce_release("0.1.0", root=world_root, fixture_root=FIXTURE_ROOT)
    assert result["ok"] is True, result


def test_reproduce_detects_modified_reference(world_root: Path) -> None:
    ref = _public(world_root)
    (ref / "README.md").write_text("edited\n", encoding="utf-8")
    result = reproduce_release("0.1.0", root=world_root, fixture_root=FIXTURE_ROOT)
    assert result["ok"] is False
    assert result["differing"] == ["README.md"]


def test_reproduce_reports_missing_and_extra(world_root: Path) -> None:
    ref = _public(world_root)
    parts = list((ref / "provenance").rglob("part.parquet"))
    assert parts
    rel = str(parts[0].relative_to(ref)).replace("\\", "/")
    parts[0].unlink()
    (ref / "legacy.txt").write_text("x", encoding="utf-8")
    result = reproduce_release("0.1.0", root=world_root, fixture_root=FIXTURE_ROOT)
    assert result["ok"] is False
    assert rel in result["extra_in_candidate"]
    assert result["missing_in_candidate"] == ["legacy.txt"]


def test_allow_extra_tolerates_pre_provenance_releases(world_root: Path) -> None:
    ref = _public(world_root)
    for part in (ref / "provenance").rglob("part.parquet"):
        part.unlink()
    strict = reproduce_release("0.1.0", root=world_root, fixture_root=FIXTURE_ROOT)
    lenient = reproduce_release(
        "0.1.0",
        root=world_root,
        fixture_root=FIXTURE_ROOT,
        allow_extra=True,
    )
    assert strict["ok"] is False
    assert lenient["ok"] is True


def test_reproduce_never_modifies_reference(world_root: Path) -> None:
    ref = _public(world_root)
    before = {p.name: p.read_bytes() for p in ref.rglob("*") if p.is_file()}
    reproduce_release("0.1.0", root=world_root, fixture_root=FIXTURE_ROOT)
    after = {p.name: p.read_bytes() for p in ref.rglob("*") if p.is_file()}
    assert before == after


def test_reproduce_missing_reference_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        reproduce_release("9.9.9", root=tmp_path)


def test_manifest_semantic_diff_flags_changed_gate(world_root: Path) -> None:
    ref = _public(world_root)
    cand = Path(
        run_release("0.1.0", root=world_root, staging=True, force=True)["path"],
    )
    assert reproduce_is_ok(diff_release_trees(ref, cand), allow_extra=False)
    import json

    path = cand / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["n_included_variables"] = 3
    path.write_text(json.dumps(manifest), encoding="utf-8")
    diff = diff_release_trees(ref, cand)
    assert diff["manifest_fields_differing"] == ["n_included_variables"]
    assert not reproduce_is_ok(diff, allow_extra=True)
