"""Variable catalog load, validate, and LICENSES.md generation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator

from imsatlas_etl.paths import (
    catalog_schema_path,
    catalog_yaml_path,
    licenses_md_path,
)
from imsatlas_etl.sources import load_sources, validate_sources

ALLOWED_FACTORS = frozenset(
    {
        "demand",
        "cost_access",
        "logistics",
        "competition",
        "product_fit",
        "macro_risk",
        "institutional",
        "openness",
        "communication",
        "entrepreneurship",
        "sustainability",
    },
)
ALLOWED_STATUS = frozenset({"draft", "verified"})


class CatalogValidationError(ValueError):
    """Raised when the catalog fails schema or atlas business rules."""


def load_catalog(path: Path | None = None) -> dict[str, Any]:
    target = path or catalog_yaml_path()
    with target.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise CatalogValidationError(f"{target}: root must be a mapping")
    return data


def load_schema(path: Path | None = None) -> dict[str, Any]:
    target = path or catalog_schema_path()
    with target.open(encoding="utf-8") as handle:
        schema = json.load(handle)
    if not isinstance(schema, dict):
        raise CatalogValidationError(f"{target}: schema root must be an object")
    return schema


def validate_catalog(
    data: dict[str, Any],
    *,
    schema: dict[str, Any] | None = None,
) -> list[str]:
    """Validate catalog; return a list of error strings (empty = ok)."""
    errors: list[str] = []
    schema_doc = schema or load_schema()
    validator = Draft202012Validator(schema_doc)
    for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        loc = ".".join(str(p) for p in err.path) or "<root>"
        errors.append(f"{loc}: {err.message}")

    factors = data.get("factors")
    if isinstance(factors, list):
        for factor in factors:
            if factor not in ALLOWED_FACTORS:
                errors.append(f"factors: {factor!r} not in allowlist")

    variables = data.get("variables")
    if not isinstance(variables, list):
        return errors

    seen: set[str] = set()
    for index, var in enumerate(variables):
        if not isinstance(var, dict):
            errors.append(f"variables[{index}]: expected object")
            continue
        vid = var.get("id")
        prefix = f"variables[{index}]({vid})"
        if not isinstance(vid, str):
            errors.append(f"{prefix}: missing id")
            continue
        if vid in seen:
            errors.append(f"{prefix}: duplicate id {vid!r}")
        seen.add(vid)

        factor = var.get("factor")
        if factor not in ALLOWED_FACTORS:
            errors.append(f"{prefix}: factor {factor!r} not in allowlist")

        status = var.get("status")
        if status not in ALLOWED_STATUS:
            errors.append(f"{prefix}: status must be draft|verified, got {status!r}")

        redistributable = var.get("redistributable")
        byod_only = var.get("byod_only")
        if redistributable is False:
            if byod_only is not True:
                errors.append(
                    f"{prefix}: redistributable false requires byod_only true (BYOD)",
                )
        elif redistributable is True and byod_only is True:
            errors.append(
                f"{prefix}: redistributable true cannot set byod_only true",
            )

        source_ids = var.get("source_ids")
        if not isinstance(source_ids, list) or not source_ids:
            errors.append(f"{prefix}: source_ids must be a non-empty list")
        elif any(not isinstance(sid, str) or not sid for sid in source_ids):
            errors.append(f"{prefix}: source_ids entries must be non-empty strings")

        rights_override = var.get("rights")
        if rights_override is not None:
            if not isinstance(rights_override, dict):
                errors.append(f"{prefix}: rights override must be an object")
            elif (
                not isinstance(rights_override.get("override_reason"), str)
                or not str(
                    rights_override.get("override_reason", ""),
                ).strip()
            ):
                errors.append(f"{prefix}: rights override requires override_reason")

        years = var.get("years")
        if isinstance(years, list) and len(years) == 2:
            start, end = years
            if isinstance(start, int) and isinstance(end, int) and start > end:
                errors.append(f"{prefix}: years start > end")

    # Cross-check source_ids against sources.yaml when present.
    sources_path = catalog_yaml_path().parent / "sources.yaml"
    if sources_path.is_file():
        try:
            sources_data = load_sources(sources_path)
            source_errors = validate_sources(sources_data)
            errors.extend(f"sources.yaml: {e}" for e in source_errors)
            known = {
                s["id"]
                for s in sources_data.get("sources", [])
                if isinstance(s, dict) and isinstance(s.get("id"), str)
            }
            for index, var in enumerate(variables):
                if not isinstance(var, dict):
                    continue
                for sid in var.get("source_ids") or []:
                    if sid not in known:
                        errors.append(
                            f"variables[{index}]({var.get('id')}): "
                            f"unknown source_id {sid!r}",
                        )
        except Exception as exc:  # noqa: BLE001 — surface as validation error
            errors.append(f"sources.yaml: failed to load ({exc})")

    return errors


def assert_valid_catalog(
    data: dict[str, Any],
    *,
    schema: dict[str, Any] | None = None,
) -> None:
    errors = validate_catalog(data, schema=schema)
    if errors:
        raise CatalogValidationError(
            "catalog validation failed:\n- " + "\n- ".join(errors),
        )


def render_licenses_md(data: dict[str, Any]) -> str:
    licence_by_source: dict[str, str] = {}
    sources_path = catalog_yaml_path().parent / "sources.yaml"
    if sources_path.is_file():
        sources_data = load_sources(sources_path)
        for source in sources_data.get("sources", []):
            if isinstance(source, dict) and isinstance(source.get("id"), str):
                rights = source.get("rights") or {}
                licence_by_source[source["id"]] = str(
                    rights.get("licence_id", "UNKNOWN"),
                )

    lines = [
        "# Variable licences",
        "",
        "Generated from `catalog/variables.yaml` + `catalog/sources.yaml`. "
        "Do not edit by hand. See also `catalog/RIGHTS.md` for the gate.",
        "",
        "| Variable | source_ids | Licence(s) | Redistributable | Citation |",
        "| --- | --- | --- | --- | --- |",
    ]
    for var in data.get("variables", []):
        if not isinstance(var, dict):
            continue
        redistributable = "yes" if var.get("redistributable") else "no (BYOD)"
        citation = str(var.get("citation", "")).replace("|", "\\|")
        ids = var.get("source_ids") or []
        licences = "; ".join(licence_by_source.get(sid, "UNKNOWN") for sid in ids)
        lines.append(
            "| {id} | {sids} | {licence} | {redist} | {citation} |".format(
                id=var.get("id", ""),
                sids=",".join(ids),
                licence=licences,
                redist=redistributable,
                citation=citation,
            ),
        )
    lines.append("")
    return "\n".join(lines)


def write_licenses_md(
    data: dict[str, Any] | None = None,
    *,
    path: Path | None = None,
) -> Path:
    catalog = data or load_catalog()
    assert_valid_catalog(catalog)
    target = path or licenses_md_path()
    target.write_text(render_licenses_md(catalog), encoding="utf-8")
    return target
