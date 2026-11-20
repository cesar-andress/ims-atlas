"""Transparency bundle export for Phase 7b SPA views.

Does not depend on gitignored ``data/release/`` or ``status/`` trees (CI clean
checkouts have neither). Seeds a minimal ATLAS_ROOT instead.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from imsatlas_etl.export_transparency import write_transparency_bundle
from imsatlas_etl.paths import repo_root


def _seed_export_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    for name in ("catalog", "config"):
        shutil.copytree(repo_root() / name, tmp_path / name)
    monkeypatch.setenv("ATLAS_ROOT", str(tmp_path))

    status = tmp_path / "status"
    status.mkdir(parents=True)
    (status / "runs").mkdir()
    (status / "freshness.json").write_text(
        json.dumps(
            {
                "generated_at": "2026-01-01T00:00:00Z",
                "mode": "fixture",
                "sources": [
                    {
                        "id": "baci",
                        "mode": "fixture",
                        "upstream_version": "mini-2022",
                        "landing_url": "https://example.test/baci",
                    }
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )
    (status / "qa.json").write_text(
        json.dumps({"status": "pass", "n_warn": 0, "n_block": 0, "checks": []}) + "\n",
        encoding="utf-8",
    )
    (status / "lineage.json").write_text(
        json.dumps({"edges": [], "nodes": []}) + "\n",
        encoding="utf-8",
    )
    (status / "runs" / "20260101T000000Z-abcd.json").write_text(
        json.dumps(
            {
                "run_id": "20260101T000000Z-abcd",
                "mode": "fixture",
                "status": "ok",
                "started_at": "2026-01-01T00:00:00Z",
                "ended_at": "2026-01-01T00:01:00Z",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    release = tmp_path / "data" / "release" / "public" / "v1.0.0"
    release.mkdir(parents=True)
    (tmp_path / "data" / "release" / "public" / "CURRENT").write_text(
        "1.0.0\n",
        encoding="utf-8",
    )
    (release / "manifest.json").write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "n_included_variables": 0,
                "created_at": "2026-01-01T00:00:00Z",
                "promoted_at": "2026-01-01T00:00:00Z",
                "promoted_by": "pipeline",
                "source_versions": {"baci": "mini-2022"},
                "variables": [],
                "files": [
                    {
                        "path": "country_year.parquet",
                        "bytes": 1,
                        "sha256": "0" * 64,
                        "rows": 0,
                        "licence": "test",
                    }
                ],
                "row_counts": {"country_year_rows": 0, "trade_rows": 0},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    (release / "SHA256SUMS").write_text(
        "deadbeef  country_year.parquet\n", encoding="utf-8"
    )
    (release / "README.md").write_text("fixture release\n", encoding="utf-8")
    return tmp_path


def test_write_transparency_bundle(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _seed_export_root(tmp_path, monkeypatch)
    info = write_transparency_bundle()
    status = root / "app" / "public" / "status"
    assert (status / "freshness.json").is_file()
    assert (status / "qa.json").is_file()
    assert (status / "lineage.json").is_file()
    assert (status / "sources.json").is_file()
    assert (status / "variables.json").is_file()
    assert (status / "releases.json").is_file()
    assert (status / "index.json").is_file()
    assert (status / "runs" / "latest.json").is_file()

    sources = json.loads((status / "sources.json").read_text(encoding="utf-8"))
    assert sources["n_sources"] == len(sources["sources"])
    assert sources["n_sources"] > 0
    assert all("landing_url" in s for s in sources["sources"])

    variables = json.loads((status / "variables.json").read_text(encoding="utf-8"))
    assert variables["n_variables"] == len(variables["variables"])
    assert any(v["id"] == "TARIF" for v in variables["variables"])

    index = json.loads((status / "index.json").read_text(encoding="utf-8"))
    assert index["current_release"] == info["release_version"]
    rel = info["release_version"]
    manifest = root / "app" / "public" / "data" / f"v{rel}" / "manifest.json"
    assert manifest.is_file()
    spa_manifest = json.loads(manifest.read_text(encoding="utf-8"))
    # SPA mirror must not embed the per-file parquet inventory.
    assert "files" not in spa_manifest
    assert spa_manifest.get("files_omitted") is True
    assert "n_included_variables" in spa_manifest
    assert not (manifest.parent / "SHA256SUMS").is_file()
