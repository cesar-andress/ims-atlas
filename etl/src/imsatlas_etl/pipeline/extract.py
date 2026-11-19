"""Step 2: download/copy into data/raw/<source>/<version>/."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from imsatlas_etl.connectors import baci, gravity, hofstede, wits
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.pipeline.io_paths import PIPELINE_SOURCES, freshness_path


def _versions_from_freshness(
    *,
    root: Path | None,
    sources: list[str],
) -> dict[str, str]:
    path = freshness_path(root=root)
    if not path.is_file():
        raise FileNotFoundError(
            f"missing {path}; run atlas-etl check first",
        )
    payload = json.loads(path.read_text(encoding="utf-8"))
    by_id = {row["source"]: row for row in payload.get("sources", [])}
    out: dict[str, str] = {}
    for source_id in sources:
        row = by_id.get(source_id)
        if not row:
            raise KeyError(f"source {source_id} not in freshness.json")
        out[source_id] = str(row["upstream_version"])
    return out


def extract_source(
    source_id: str,
    version: str,
    *,
    fixture_root: Path | None,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    if fixture_root is None:
        raise RuntimeError(
            "live extract for zip/API sources is not enabled in this phase without "
            "fixtures; pass --fixture-root or run the offline pipeline",
        )
    if source_id in {"worldbank_wdi", "worldbank_wgi", "worldbank_lpi"}:
        return wb.extract_from_fixture(
            source_id,
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    if source_id == "baci":
        return baci.extract_from_fixture(
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    if source_id == "cepi_gravity":
        return gravity.extract_from_fixture(
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    if source_id == "hofstede":
        return hofstede.extract_from_fixture(
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    if source_id == "wits_trains":
        return wits.extract_from_fixture(
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    raise ValueError(f"unsupported extract source: {source_id}")


def run_extract(
    *,
    sources: list[str] | None = None,
    fixture_root: Path | None = None,
    root: Path | None = None,
    force: bool = False,
) -> list[dict[str, Any]]:
    selected = list(sources) if sources else list(PIPELINE_SOURCES)
    for source_id in selected:
        if source_id not in PIPELINE_SOURCES:
            raise ValueError(f"unknown pipeline source: {source_id}")
    versions = _versions_from_freshness(root=root, sources=selected)
    results: list[dict[str, Any]] = []
    for source_id in selected:
        results.append(
            extract_source(
                source_id,
                versions[source_id],
                fixture_root=fixture_root,
                root=root,
                force=force,
            ),
        )

    # Refresh ingested_version / stale after a successful extract.
    path = freshness_path(root=root)
    payload = json.loads(path.read_text(encoding="utf-8"))
    by_result = {r["source"]: r["version"] for r in results}
    for row in payload.get("sources", []):
        sid = row.get("source")
        if sid in by_result:
            row["ingested_version"] = by_result[sid]
            row["stale"] = row.get("upstream_version") != by_result[sid]
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return results
