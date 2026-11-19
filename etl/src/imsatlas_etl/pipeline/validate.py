"""Step 3: pandera contracts on raw tables (fail closed)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandera.errors as pa_errors

from imsatlas_etl.connectors import baci, country_index, gravity, hofstede, wits
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.contracts.schemas import RAW_CONTRACTS
from imsatlas_etl.pipeline.io_paths import (
    PHASE3_INDEX_SOURCES,
    PIPELINE_SOURCES,
    freshness_path,
    raw_source_dir,
)


def _version_for(source_id: str, *, root: Path | None) -> str:
    path = freshness_path(root=root)
    payload = json.loads(path.read_text(encoding="utf-8"))
    for row in payload["sources"]:
        if row["source"] == source_id:
            return str(row["upstream_version"])
    raise KeyError(source_id)


def _load_raw(source_id: str, version: str, *, root: Path | None):
    directory = raw_source_dir(source_id, version, root=root)
    if source_id.startswith("worldbank_"):
        return wb.load_raw_indicators(directory / "indicators.csv")
    if source_id == "baci":
        return baci.load_raw_trade(directory / "trade.csv")
    if source_id == "cepi_gravity":
        return gravity.load_raw_bilateral(directory / "bilateral.csv")
    if source_id == "hofstede":
        return hofstede.load_raw_dimensions(directory / "dimensions.csv")
    if source_id == "wits_trains":
        return wits.load_raw_tariffs(directory / "tariffs.csv")
    if source_id in PHASE3_INDEX_SOURCES:
        frame, unmatched = country_index.load_raw_values(directory / "values.csv")
        if unmatched:
            raise ValueError(
                f"{source_id}: {len(unmatched)} unmatched country names "
                f"(explicit ISO3 map only): {unmatched[:5]}",
            )
        return frame
    raise ValueError(source_id)


def validate_source(
    source_id: str,
    *,
    root: Path | None = None,
) -> dict[str, Any]:
    schema = RAW_CONTRACTS[source_id]
    version = _version_for(source_id, root=root)
    frame = _load_raw(source_id, version, root=root)
    try:
        schema.validate(frame, lazy=True)
    except pa_errors.SchemaErrors as exc:
        report = str(exc.failure_cases.head(20).to_dict())
        raise ValueError(
            f"contract failed for {source_id}@{version}:\n{report}",
        ) from exc
    return {
        "source": source_id,
        "version": version,
        "rows": int(len(frame)),
        "ok": True,
    }


def run_validate(
    *,
    sources: list[str] | None = None,
    root: Path | None = None,
    force: bool = False,  # noqa: ARG001
) -> list[dict[str, Any]]:
    selected = list(sources) if sources else list(PIPELINE_SOURCES)
    results: list[dict[str, Any]] = []
    errors: list[str] = []
    for source_id in selected:
        if source_id not in PIPELINE_SOURCES:
            raise ValueError(f"unknown pipeline source: {source_id}")
        try:
            results.append(validate_source(source_id, root=root))
        except Exception as exc:  # noqa: BLE001 — collect all contract failures
            errors.append(f"{source_id}: {exc}")
    if errors:
        raise ValueError("validate failed:\n- " + "\n- ".join(errors))
    return results
