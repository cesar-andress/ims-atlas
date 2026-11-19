"""Filesystem layout for raw/curated/status artefacts."""

from __future__ import annotations

from pathlib import Path

from imsatlas_etl.paths import repo_root

PIPELINE_SOURCES = (
    "worldbank_wdi",
    "worldbank_wgi",
    "worldbank_lpi",
    "baci",
    "cepi_gravity",
    "wits_trains",
    "hofstede",
)


def data_root(root: Path | None = None) -> Path:
    return (root or repo_root()) / "data"


def status_root(root: Path | None = None) -> Path:
    return (root or repo_root()) / "status"


def raw_source_dir(source_id: str, version: str, *, root: Path | None = None) -> Path:
    return data_root(root) / "raw" / source_id / version


def curated_dir(*, root: Path | None = None) -> Path:
    return data_root(root) / "curated"


def freshness_path(*, root: Path | None = None) -> Path:
    return status_root(root) / "freshness.json"


def runs_dir(*, root: Path | None = None) -> Path:
    return status_root(root) / "runs"
