"""Step 1: cheap upstream version check -> status/freshness.json."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.io_paths import PIPELINE_SOURCES, freshness_path


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _ingested_version(source_id: str, *, root: Path | None) -> str | None:
    from imsatlas_etl.pipeline.io_paths import data_root

    base = data_root(root) / "raw" / source_id
    if not base.is_dir():
        return None
    versions = sorted(p.name for p in base.iterdir() if p.is_dir())
    return versions[-1] if versions else None


def check_source_offline(
    source_id: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
) -> dict[str, Any]:
    """Read version metadata from recorded fixtures (no network)."""
    meta_path = fixture_root / source_id / "version.json"
    if not meta_path.is_file():
        raise FileNotFoundError(
            f"missing fixture version.json for {source_id}: {meta_path}",
        )
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    upstream_version = str(meta["upstream_version"])
    upstream_changed_at = meta.get("upstream_changed_at")
    ingested = _ingested_version(source_id, root=root)
    stale = ingested != upstream_version
    return {
        "source": source_id,
        "checked_at": _now_iso(),
        "upstream_version": upstream_version,
        "upstream_changed_at": upstream_changed_at,
        "ingested_version": ingested,
        "stale": stale,
        "mode": "fixture",
    }


def check_source_live(source_id: str, *, root: Path | None = None) -> dict[str, Any]:
    """Live version probe (network).

    World Bank uses series lastupdated when available.
    """
    from imsatlas_etl.connectors import worldbank as wb

    if source_id in {"worldbank_wdi", "worldbank_wgi", "worldbank_lpi"}:
        probe = wb.probe_version(source_id)
    else:
        # For zip/manual sources without a cheap API, mark version unknown-live.
        probe = {
            "upstream_version": "live-unknown",
            "upstream_changed_at": None,
            "note": "no cheap version endpoint; use fixture check or manual version",
        }
    ingested = _ingested_version(source_id, root=root)
    upstream_version = str(probe["upstream_version"])
    return {
        "source": source_id,
        "checked_at": _now_iso(),
        "upstream_version": upstream_version,
        "upstream_changed_at": probe.get("upstream_changed_at"),
        "ingested_version": ingested,
        "stale": ingested != upstream_version,
        "mode": "live",
        "note": probe.get("note"),
    }


def run_check(
    *,
    sources: list[str] | None = None,
    fixture_root: Path | None = None,
    root: Path | None = None,
    force: bool = False,  # noqa: ARG001 — reserved for cache bypass
) -> list[dict[str, Any]]:
    selected = list(sources) if sources else list(PIPELINE_SOURCES)
    rows: list[dict[str, Any]] = []
    for source_id in selected:
        if source_id not in PIPELINE_SOURCES:
            raise ValueError(f"unknown pipeline source: {source_id}")
        if fixture_root is not None:
            rows.append(
                check_source_offline(source_id, fixture_root=fixture_root, root=root),
            )
        else:
            rows.append(check_source_live(source_id, root=root))

    out = freshness_path(root=root)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"generated_at": _now_iso(), "sources": rows}
    out.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return rows
