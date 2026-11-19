"""Source registry load and validate (SPEC §10.1)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator

from imsatlas_etl.paths import sources_schema_path, sources_yaml_path


class SourcesValidationError(ValueError):
    """Raised when sources.yaml fails schema or business rules."""


def load_sources(path: Path | None = None) -> dict[str, Any]:
    target = path or sources_yaml_path()
    with target.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise SourcesValidationError(f"{target}: root must be a mapping")
    return data


def load_sources_schema(path: Path | None = None) -> dict[str, Any]:
    target = path or sources_schema_path()
    with target.open(encoding="utf-8") as handle:
        schema = json.load(handle)
    if not isinstance(schema, dict):
        raise SourcesValidationError(f"{target}: schema root must be an object")
    return schema


def validate_sources(
    data: dict[str, Any],
    *,
    schema: dict[str, Any] | None = None,
) -> list[str]:
    errors: list[str] = []
    schema_doc = schema or load_sources_schema()
    validator = Draft202012Validator(schema_doc)
    for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        loc = ".".join(str(p) for p in err.path) or "<root>"
        errors.append(f"{loc}: {err.message}")

    sources = data.get("sources")
    if not isinstance(sources, list):
        return errors

    seen: set[str] = set()
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            errors.append(f"sources[{index}]: expected object")
            continue
        sid = source.get("id")
        prefix = f"sources[{index}]({sid})"
        if not isinstance(sid, str):
            errors.append(f"{prefix}: missing id")
            continue
        if sid in seen:
            errors.append(f"{prefix}: duplicate id {sid!r}")
        seen.add(sid)

        rights = source.get("rights")
        if isinstance(rights, dict):
            evidence = rights.get("evidence")
            if isinstance(evidence, dict) and evidence.get("checked_by"):
                if not evidence.get("checked_on") or not evidence.get(
                    "snapshot_sha256",
                ):
                    errors.append(
                        f"{prefix}: checked_by set requires checked_on and "
                        "snapshot_sha256",
                    )

    return errors


def assert_valid_sources(
    data: dict[str, Any],
    *,
    schema: dict[str, Any] | None = None,
) -> None:
    errors = validate_sources(data, schema=schema)
    if errors:
        raise SourcesValidationError(
            "sources validation failed:\n- " + "\n- ".join(errors),
        )


def sources_by_id(data: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    registry = data or load_sources()
    assert_valid_sources(registry)
    out: dict[str, dict[str, Any]] = {}
    for source in registry["sources"]:
        out[source["id"]] = source
    return out
