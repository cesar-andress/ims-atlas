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
