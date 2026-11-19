from __future__ import annotations

import json
from pathlib import Path

from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.io_paths import staging_release_dir
from imsatlas_etl.pipeline.release import (
    MAX_RELEASE_BYTES,
    MAX_SINGLE_FILE_BYTES,
    rebuild_release_bytes,
    run_release,
    write_zenodo_dataset_json,
)
from imsatlas_etl.pipeline.runner import run_pipeline

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


def test_spec3_release_layout_and_budgets(tmp_path: Path) -> None:
    run_pipeline(fixture_root=FIXTURE_ROOT, root=tmp_path, force=True)
    result = run_release("0.1.0", root=tmp_path, staging=True, force=True)
    dest = Path(result["path"])

    assert (dest / "country_year.parquet").is_file()
    assert (dest / "bilateral_year.parquet").is_file()
    assert (dest / "catalog.json").is_file()
    assert (dest / "manifest.json").is_file()
    assert (dest / "LICENSES.md").is_file()
    assert (dest / "README.md").is_file()
    assert (dest / "CHANGELOG.md").is_file()
    assert list((dest / "trade").glob("hs2=*/part.parquet"))

    catalog = json.loads((dest / "catalog.json").read_text(encoding="utf-8"))
    assert catalog["n_variables"] == 0
    assert catalog["variables"] == []

    manifest = json.loads((dest / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["spec"] == "SPEC §3"
    assert manifest["size_bytes"]["total_bytes"] <= MAX_RELEASE_BYTES
    assert manifest["size_bytes"]["largest_bytes"] <= MAX_SINGLE_FILE_BYTES
    assert result["n_included_variables"] == 0


def test_byte_identical_rebuild_and_zenodo(tmp_path: Path) -> None:
    run_pipeline(fixture_root=FIXTURE_ROOT, root=tmp_path, force=True)
    info = rebuild_release_bytes("0.1.0", root=tmp_path, staging=True)
    assert info["data_files_identical"] == "true"

    zenodo = write_zenodo_dataset_json(version="0.1.0", path=tmp_path / "z.json")
    payload = json.loads(zenodo.read_text(encoding="utf-8"))
    assert payload["upload_type"] == "dataset"
    assert payload["version"] == "0.1.0"
    assert any("ims-atlas" in r["identifier"] for r in payload["related_identifiers"])


def test_config_data_json_matches_default_version() -> None:
    cfg = json.loads((repo_root() / "config" / "data.json").read_text(encoding="utf-8"))
    assert cfg["release_version"] == "0.1.0"
    assert cfg["release_base_path"] == "/data"
    # Staging path helper still uses v-prefix
    assert staging_release_dir().name == "staging"
