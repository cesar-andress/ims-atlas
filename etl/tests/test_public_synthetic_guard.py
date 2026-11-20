"""Phase 12-fix: synthetic ranking fixtures must never ship under public/dist."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

import pytest

from imsatlas_etl.export_transparency import (
    payload_is_fixture,
    with_fixture_flag,
    write_transparency_bundle,
)
from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.runner import run_pipeline

PADDED_ISO = re.compile(r'"X\d{2}"')
SYNTHETIC_TRUE = re.compile(r'"synthetic"\s*:\s*true', re.IGNORECASE)


def _scan_tree(root: Path) -> list[str]:
    hits: list[str] = []
    if not root.is_dir():
        return hits
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        name = path.name
        if name.startswith("phase8_col_hs64"):
            rel = path.relative_to(repo_root())
            hits.append(f"{rel}: legacy synthetic panel filename")
            continue
        if path.suffix.lower() not in {
            ".json",
            ".js",
            ".css",
            ".html",
            ".map",
            ".txt",
            ".md",
        }:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = str(path.relative_to(repo_root()))
        if SYNTHETIC_TRUE.search(text):
            hits.append(f"{rel}: synthetic:true")
        if PADDED_ISO.search(text):
            hits.append(f"{rel}: padded iso3 X##")
        if "build_col_hs64_block" in text:
            hits.append(f"{rel}: build_col_hs64_block marker")
        if path.suffix.lower() == ".json":
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            block = data.get("block") if isinstance(data, dict) else None
            if isinstance(block, dict) and "ranking_expert" in block and "raw" in block:
                if data.get("status") == "pending":
                    continue
                # Public illustrative example (ship_raw only) is allowed when labelled.
                illustrative = data.get("illustrative") is True
                if illustrative and data.get("synthetic") is not True:
                    continue
                hits.append(f"{rel}: ranking block in product tree")
    return hits


@pytest.mark.parametrize("subdir", ["app/public", "app/dist"])
def test_public_tree_has_no_synthetic_demo_panel(subdir: str) -> None:
    root = repo_root() / subdir
    if not root.is_dir():
        pytest.skip(f"{subdir} not present")
    hits = _scan_tree(root)
    assert hits == [], "Synthetic demo leaked into product tree:\n" + "\n".join(hits)


def test_public_col_hs64_demo_is_pending_or_illustrative() -> None:
    path = repo_root() / "app/public/meta/col_hs64_demo.json"
    assert path.is_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("status") == "pending":
        assert "block" not in data
        assert data["origin"] == "COL"
        assert data["hs"] == "64"
        assert data["year"] == 2023
        return
    assert data.get("illustrative") is True
    assert data.get("synthetic") is not True
    assert "block" in data
    assert data["block"]["origin"] == "COL"
    assert data["block"]["hs"] == "64"
    assert len(data["block"]["candidates"]) >= 20
    text = path.read_text(encoding="utf-8")
    assert '"TARIF"' not in text and '"CULT"' not in text


# --- Fixture-mode pipeline artefacts must not pose as a live public release ---

# Markers of fixture data. `is_fixture` itself is deliberately not a marker here.
RAW_FIXTURE_MARKERS = re.compile(r'"mode": "fixture"|"fixture_mode": true|"mini-')
FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


def unflagged_fixture_artefacts(base: Path, *, patterns: tuple[str, ...]) -> list[str]:
    """JSON files under ``base`` that are fixture *runs* but lack is_fixture:true.

    Top-level ``mode: live`` files are not treated as fixture publishes even if a
    nested source row still mentions fixture (Phase L honesty = run mode).
    """
    hits: list[str] = []
    for pattern in patterns:
        for path in sorted(base.glob(pattern)):
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                continue
            # Explicit live publish (or mode:live) is honest even if a nested
            # field still mentions a historical mini- / fixture probe.
            if data.get("is_fixture") is False:
                continue
            if data.get("mode") == "live" and data.get("fixture_mode") is not True:
                continue
            text = json.dumps(data, sort_keys=True)
            if RAW_FIXTURE_MARKERS.search(text) and data.get("is_fixture") is not True:
                hits.append(str(path.relative_to(base)))
    return hits


def test_public_status_fixture_artefacts_carry_is_fixture_flag() -> None:
    public = repo_root() / "app" / "public"
    if not (public / "status").is_dir():
        pytest.skip("app/public/status not present")
    hits = unflagged_fixture_artefacts(
        public,
        patterns=("status/*.json", "status/runs/*.json", "data/v*/manifest.json"),
    )
    assert hits == [], (
        "fixture artefacts published without is_fixture:true:\n" + "\n".join(hits)
    )


def test_with_fixture_flag_marks_and_unmarks() -> None:
    marked = with_fixture_flag({"a": 1}, True)
    assert marked["is_fixture"] is True and "fixture_banner" in marked
    clean = with_fixture_flag(marked, False)
    assert clean["is_fixture"] is False and "fixture_banner" not in clean


def test_payload_is_fixture_detects_mini_world_and_mode() -> None:
    assert payload_is_fixture({"sources": [{"mode": "fixture"}]})
    assert payload_is_fixture({"upstream_version": "mini-2022"})
    assert payload_is_fixture({"fixture_mode": True})
    assert not payload_is_fixture({"sources": [{"mode": "live", "v": "2024-01-15"}]})


def test_top_level_is_fixture_ignores_nested_source_modes() -> None:
    from imsatlas_etl.export_transparency import top_level_is_fixture

    nested = {"mode": "live", "sources": [{"mode": "fixture"}]}
    assert top_level_is_fixture(nested) is False
    assert top_level_is_fixture({"mode": "fixture"}) is True
    assert top_level_is_fixture({"fixture_mode": True, "mode": "live"}) is True
    assert top_level_is_fixture({"mode": "live", "is_fixture": True}) is False


def test_latest_run_skips_latest_pointer(tmp_path: Path) -> None:
    from imsatlas_etl.export_transparency import _latest_run

    runs = tmp_path / "runs"
    runs.mkdir()
    older = runs / "20260101T000000Z-aaaa.json"
    newer = runs / "20260102T000000Z-bbbb.json"
    pointer = runs / "latest.json"
    older.write_text('{"mode":"fixture"}\n', encoding="utf-8")
    newer.write_text('{"mode":"live"}\n', encoding="utf-8")
    pointer.write_text('{"mode":"fixture","stale":true}\n', encoding="utf-8")
    latest = _latest_run(runs)
    assert latest is not None
    assert latest.name == "20260102T000000Z-bbbb.json"


def _export_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, *, live: bool
) -> Path:
    for name in ("catalog", "config"):
        shutil.copytree(repo_root() / name, tmp_path / name)
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))
    run_pipeline(fixture_root=FIXTURE_ROOT, root=tmp_path, force=True)
    from imsatlas_etl.pipeline.lineage import write_lineage
    from imsatlas_etl.pipeline.qa import run_qa

    run_qa(root=tmp_path)
    write_lineage(root=tmp_path)
    current = tmp_path / "data" / "release" / "public"
    (current / "v1.0.0").mkdir(parents=True)
    (current / "CURRENT").write_text("1.0.0\n", encoding="utf-8")
    versions = {"baci": "mini-2022"}
    (current / "v1.0.0" / "manifest.json").write_text(
        json.dumps({"source_versions": versions, "variables": []}),
        encoding="utf-8",
    )
    if live:  # rewrite the artefacts as if produced by a live run
        targets = [tmp_path / r for r in ("status/freshness.json", "status/qa.json")]
        targets += [tmp_path / "status/lineage.json"]
        targets += list((tmp_path / "status" / "runs").glob("*.json"))
        for path in targets:
            text = path.read_text(encoding="utf-8")
            for old, new in (
                ("mini-2022", "2024-01-15"),
                ('"mode": "fixture"', '"mode": "live"'),
                ('"is_fixture": true', '"is_fixture": false'),
                ('"fixture_mode": true', '"fixture_mode": false'),
            ):
                text = text.replace(old, new)
            path.write_text(text, encoding="utf-8")
        (current / "v1.0.0" / "manifest.json").write_text(
            json.dumps({"source_versions": {"baci": "2024-01-15"}, "variables": []}),
            encoding="utf-8",
        )
    return tmp_path


def test_export_flags_fixture_run_everywhere_in_public_bundle(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _export_root(tmp_path, monkeypatch, live=False)
    info = write_transparency_bundle()
    assert info["is_fixture"] == "true"
    public = root / "app" / "public"
    assert (
        unflagged_fixture_artefacts(
            public,
            patterns=("status/*.json", "status/runs/*.json", "data/v*/manifest.json"),
        )
        == []
    )
    for name in ("freshness", "sources", "variables", "index", "qa", "lineage"):
        data = json.loads((public / "status" / f"{name}.json").read_text())
        assert data["is_fixture"] is True, name
        assert "Not a live ingest" in data["fixture_banner"], name
    # The host-served copy under status/ is flagged too.
    host = json.loads((root / "status" / "freshness.json").read_text())
    assert host["is_fixture"] is True
    manifest = json.loads((public / "data/v1.0.0/manifest.json").read_text())
    assert manifest["is_fixture"] is True


def test_export_of_live_run_is_not_flagged_fixture(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _export_root(tmp_path, monkeypatch, live=True)
    info = write_transparency_bundle()
    assert info["is_fixture"] == "false"
    freshness = json.loads((root / "app/public/status/freshness.json").read_text())
    assert freshness["is_fixture"] is False
    assert "fixture_banner" not in freshness
    assert {r["mode"] for r in freshness["sources"]} == {"live"}


def test_guard_detects_unflagged_fixture_payload(tmp_path: Path) -> None:
    (tmp_path / "status").mkdir()
    (tmp_path / "status" / "freshness.json").write_text(
        json.dumps({"sources": [{"upstream_version": "mini-2022", "mode": "fixture"}]}),
    )
    assert unflagged_fixture_artefacts(tmp_path, patterns=("status/*.json",)) == [
        "status/freshness.json",
    ]
