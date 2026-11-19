"""Transparency bundle export for Phase 7b SPA views."""

from __future__ import annotations

import json

from imsatlas_etl.export_transparency import write_transparency_bundle
from imsatlas_etl.paths import repo_root


def test_write_transparency_bundle() -> None:
    info = write_transparency_bundle()
    root = repo_root()
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
