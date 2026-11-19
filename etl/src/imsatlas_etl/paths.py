"""Repository path helpers."""

from __future__ import annotations

from pathlib import Path


def repo_root() -> Path:
    """Return the ims-atlas repository root (parent of etl/)."""
    return Path(__file__).resolve().parents[3]


def catalog_dir() -> Path:
    return repo_root() / "catalog"


def catalog_yaml_path() -> Path:
    return catalog_dir() / "variables.yaml"


def catalog_schema_path() -> Path:
    return catalog_dir() / "schema.json"


def licenses_md_path() -> Path:
    return catalog_dir() / "LICENSES.md"


def sources_yaml_path() -> Path:
    return catalog_dir() / "sources.yaml"


def sources_schema_path() -> Path:
    return catalog_dir() / "sources.schema.json"


def rights_md_path() -> Path:
    return catalog_dir() / "RIGHTS.md"


def gate_cases_path() -> Path:
    return catalog_dir() / "gate_cases.json"


def deployment_yaml_path() -> Path:
    return repo_root() / "config" / "deployment.yaml"


def terms_snapshots_dir() -> Path:
    return repo_root() / "data" / "local" / "terms_snapshots"
