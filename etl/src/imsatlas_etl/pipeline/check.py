"""Step 1: cheap upstream version check -> status/freshness.json."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.io_paths import (
    PIPELINE_SOURCES,
    freshness_path,
    ingested_versions,
)


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _ingested_version(
    source_id: str,
    *,
    root: Path | None,
    mode: str | None = None,
) -> str | None:
    versions = ingested_versions(source_id, mode=mode, root=root)
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
    ingested = _ingested_version(source_id, root=root, mode="fixture")
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


def _live_probe(source_id: str, *, root: Path | None) -> dict[str, Any]:
    from imsatlas_etl.connectors import baci, gravity, manual_drop, wits
    from imsatlas_etl.connectors import worldbank as wb

    if source_id in {"worldbank_wdi", "worldbank_wgi", "worldbank_lpi"}:
        return wb.probe_version(source_id)
    note = "manual drop; version from pin or content hash"
    if source_id == "baci":
        return {"upstream_version": baci.live_version(root=root), "note": note}
    if source_id == "cepi_gravity":
        return {"upstream_version": gravity.live_version(root=root), "note": note}
    if source_id == "wits_trains":
        return {
            "upstream_version": wits.live_version(root=root),
            "note": "version label from config/wits_trains.json; local_only",
        }
    if manual_drop.is_manual_source(source_id):
        return {
            "upstream_version": manual_drop.live_version(source_id, root=root),
            "note": note,
        }
    raise ValueError(f"unsupported live check source: {source_id}")


def check_source_live(source_id: str, *, root: Path | None = None) -> dict[str, Any]:
    """Live version probe.

    World Bank sources use the API ``lastupdated``; manual-drop sources use the
    pinned version or a content hash. Raises ``SourceUnavailableError`` when the
    network call fails or the manual file is missing.
    """
    probe = _live_probe(source_id, root=root)
    ingested = _ingested_version(source_id, root=root, mode="live")
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
    by_id: dict[str, dict[str, Any]] = {}
    if out.is_file() and set(selected) != set(PIPELINE_SOURCES):
        try:
            previous = json.loads(out.read_text(encoding="utf-8"))
            for old in previous.get("sources") or []:
                if isinstance(old, dict) and "source" in old:
                    by_id[str(old["source"])] = old
        except (json.JSONDecodeError, OSError):
            by_id = {}
    for row in rows:
        by_id[str(row["source"])] = row
    ordered = [by_id[sid] for sid in PIPELINE_SOURCES if sid in by_id]
    ordered += [by_id[sid] for sid in sorted(by_id) if sid not in PIPELINE_SOURCES]
    modes = {str(r.get("mode") or "") for r in ordered}
    if modes == {"fixture"}:
        mode = "fixture"
    elif "live" in modes:
        mode = "live"
    else:
        mode = "fixture" if fixture_root is not None else "live"
    payload = {
        "generated_at": _now_iso(),
        "mode": mode,
        "is_fixture": mode == "fixture",
        "sources": ordered,
    }
    out.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return rows
