from __future__ import annotations

import json
from pathlib import Path

import pytest

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.pipeline.alert import check_and_alert, write_stale_alert
from imsatlas_etl.pipeline.io_paths import (
    public_release_dir,
    staging_release_dir,
    status_root,
)
from imsatlas_etl.pipeline.lineage import write_lineage
from imsatlas_etl.pipeline.promote import promote_release
from imsatlas_etl.pipeline.qa import run_qa
from imsatlas_etl.pipeline.release import (
    list_release_variable_columns,
    rebuild_release_bytes,
    run_release,
)
from imsatlas_etl.pipeline.runner import run_pipeline
from imsatlas_etl.rights import gate_for_variable, load_deployment
from imsatlas_etl.sources import sources_by_id

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"


@pytest.fixture()
def pipeline_root(tmp_path: Path) -> Path:
    run_pipeline(fixture_root=FIXTURE_ROOT, root=tmp_path, force=True)
    return tmp_path


def test_qa_passes_on_mini_world(pipeline_root: Path) -> None:
    report = run_qa(root=pipeline_root)
    assert report["status"] == "pass"
    assert (status_root(root=pipeline_root) / "qa.json").is_file()
    assert (status_root(root=pipeline_root) / "qa.md").is_file()


def test_release_excludes_byod_variable_columns(
    pipeline_root: Path, no_ship_gate: None
) -> None:
    result = run_release("0.1.0", root=pipeline_root, staging=True, force=True)
    assert result["n_included_variables"] == 0  # all unknown rights -> byod
    release_path = Path(result["path"])
    columns = list_release_variable_columns(release_path)
    catalog = load_catalog()
    registry = sources_by_id()
    deployment = load_deployment()
    for variable in catalog["variables"]:
        gate = gate_for_variable(
            variable,
            registry=registry,
            deployment=deployment,
        )
        if gate["decision"] not in {"ship_raw", "ship_derived"}:
            assert variable["id"] not in columns


def test_release_rebuild_byte_identical_data_files(pipeline_root: Path) -> None:
    info = rebuild_release_bytes("0.1.0", root=pipeline_root, staging=True)
    assert info["data_files_identical"] == "true"


def test_promote_and_lineage(pipeline_root: Path) -> None:
    run_release("0.1.0", root=pipeline_root, staging=True, force=True)
    promoted = promote_release("0.1.0", by="Tester", root=pipeline_root, force=True)
    assert Path(promoted["path"]).is_dir()
    current = public_release_dir(root=pipeline_root) / "CURRENT"
    assert current.read_text() == "v0.1.0\n"
    staging_manifest = (
        staging_release_dir(root=pipeline_root) / "v0.1.0" / "manifest.json"
    )
    assert staging_manifest.is_file()
    lineage_path = write_lineage(root=pipeline_root)
    payload = json.loads(lineage_path.read_text(encoding="utf-8"))
    assert any(n["kind"] == "release" for n in payload["nodes"])
    assert any(n["kind"] == "variable" for n in payload["nodes"])
    assert payload["edges"]


def test_stale_alert(pipeline_root: Path) -> None:
    # Fresh after pipeline extract refresh — re-check should be not stale
    result = check_and_alert(fixture_root=FIXTURE_ROOT, root=pipeline_root)
    assert result["n_stale"] == 0
    assert result["alert_path"] is None
    # Force stale rows
    alert = write_stale_alert(
        [{"source": "baci", "stale": True, "upstream_version": "x"}],
        root=pipeline_root,
    )
    assert alert is not None
    assert alert.is_file()
