"""Rights verification helpers and RIGHTS.md report (SPEC §10.2)."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import yaml

from imsatlas_etl.catalog import CatalogValidationError, load_catalog
from imsatlas_etl.gate import gate
from imsatlas_etl.paths import (
    deployment_yaml_path,
    rights_md_path,
    sources_yaml_path,
    terms_snapshots_dir,
)
from imsatlas_etl.sources import (
    SourcesValidationError,
    assert_valid_sources,
    load_sources,
    sources_by_id,
)


def load_deployment(path: Path | None = None) -> dict[str, Any]:
    target = path or deployment_yaml_path()
    with target.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise SourcesValidationError(f"{target}: root must be a mapping")
    if "commercial_context" not in data:
        raise SourcesValidationError(f"{target}: missing commercial_context")
    return data


def resolve_variable_rights(
    variable: dict[str, Any],
    registry: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    ids = variable.get("source_ids")
    if not isinstance(ids, list) or not ids:
        raise CatalogValidationError(
            f"variable {variable.get('id')}: missing source_ids",
        )
    rights_list: list[dict[str, Any]] = []
    for sid in ids:
        source = registry.get(sid)
        if source is None:
            raise CatalogValidationError(
                f"variable {variable.get('id')}: unknown source_id {sid!r}",
            )
        rights = source.get("rights")
        if not isinstance(rights, dict):
            raise CatalogValidationError(
                f"source {sid}: missing rights record",
            )
        rights_list.append(rights)
    return rights_list


def gate_for_variable(
    variable: dict[str, Any],
    *,
    registry: dict[str, dict[str, Any]] | None = None,
    deployment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    sources = registry or sources_by_id()
    deploy = deployment or load_deployment()
    rights_list = resolve_variable_rights(variable, sources)
    return gate(rights_list, variable, deploy)


def fetch_terms_bytes(url: str, *, timeout: float = 30.0) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": "ims-atlas-etl/0.1 (+https://atlas.aiserv.es; rights-verify)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310
            return response.read()
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        raise SourcesValidationError(
            f"failed to fetch terms_url {url!r}: {exc}",
        ) from exc


RIGHTS_BASIS = frozenset(
    {"public_terms", "subscription", "contract", "written_permission"},
)
RIGHTS_SCOPE = frozenset(
    {"use", "redistribute_derived", "redistribute_raw", "commercial"},
)


def rights_verify(
    source_id: str,
    *,
    by: str,
    on: str | None = None,
    note: str | None = None,
    basis: str | None = None,
    scope: str | None = None,
    document: str | None = None,
    fetch: bool = True,
) -> dict[str, Any]:
    """Human-only: record evidence (optional terms fetch) + basis/scope reference.

    Store the *reference* (``document``), never the confidential contract body.
    ``scope`` use ≠ redistribute_*; commercial_context still applies separately.
    """
    who = by.strip()
    if not who:
        raise SourcesValidationError("--by must be a non-empty human name")
    checked_on = on or datetime.now(UTC).date().isoformat()
    if basis is not None and basis not in RIGHTS_BASIS:
        raise SourcesValidationError(
            f"--basis must be one of {sorted(RIGHTS_BASIS)}",
        )
    if scope is not None and scope not in RIGHTS_SCOPE:
        raise SourcesValidationError(
            f"--scope must be one of {sorted(RIGHTS_SCOPE)}",
        )

    path = sources_yaml_path()
    data = load_sources(path)
    assert_valid_sources(data)

    target: dict[str, Any] | None = None
    for source in data["sources"]:
        if source.get("id") == source_id:
            target = source
            break
    if target is None:
        raise SourcesValidationError(f"unknown source id: {source_id}")

    rights = target["rights"]
    terms_url = rights["evidence"].get("terms_url") or target.get("terms_url")
    if not isinstance(terms_url, str) or not terms_url.strip():
        raise SourcesValidationError(f"{source_id}: missing terms_url")

    digest: str | None = None
    snap_path: Path | None = None
    if fetch:
        body = fetch_terms_bytes(terms_url)
        digest = hashlib.sha256(body).hexdigest()
        snap_dir = terms_snapshots_dir()
        snap_dir.mkdir(parents=True, exist_ok=True)
        snap_path = snap_dir / f"{source_id}-{checked_on}-{digest[:12]}.bin"
        snap_path.write_bytes(body)

    evidence = rights["evidence"]
    evidence["checked_by"] = who
    evidence["checked_on"] = checked_on
    evidence["terms_url"] = terms_url
    if digest:
        evidence["snapshot_sha256"] = digest
    elif not evidence.get("snapshot_sha256"):
        # Schema requires a digest whenever checked_by is set.
        evidence["snapshot_sha256"] = "nofetch"
    if basis:
        evidence["basis"] = basis
    if scope:
        evidence["scope"] = scope
    if document:
        evidence["document_ref"] = document
    if note:
        evidence["note"] = note
    elif not evidence.get("note"):
        evidence["note"] = (
            f"terms snapshot saved at {snap_path.name}"
            if snap_path
            else "rights-verify without terms fetch"
        )

    # Human still must set yes/no rights flags separately; verify only records evidence.
    path.write_text(
        yaml.dump(data, sort_keys=False, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )
    return {
        "id": source_id,
        "checked_by": who,
        "checked_on": checked_on,
        "snapshot_sha256": digest or evidence.get("snapshot_sha256"),
        "snapshot_path": str(snap_path) if snap_path else None,
        "basis": basis,
        "scope": scope,
        "document_ref": document,
    }


def render_rights_md(
    *,
    catalog: dict[str, Any] | None = None,
    sources: dict[str, Any] | None = None,
    deployment: dict[str, Any] | None = None,
) -> str:
    catalog_data = catalog or load_catalog()
    sources_data = sources or load_sources()
    assert_valid_sources(sources_data)
    deploy = deployment or load_deployment()
    registry = {s["id"]: s for s in sources_data["sources"]}

    lines = [
        "# Source rights and licence gate",
        "",
        "Generated by `atlas-etl rights-report`. Do not edit by hand.",
        "",
        f"Deployment `commercial_context`: **{deploy.get('commercial_context')}** "
        f"({deploy.get('site', 'UNKNOWN')}).",
        "",
        "## Sources",
        "",
        "| Source | Licence | use_research | raw | derived | commercial | "
        "attribution | share_alike | no_derivatives | checked_by | checked_on |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]

    needing_human: list[str] = []
    for source in sources_data["sources"]:
        rights = source["rights"]
        evidence = rights.get("evidence") or {}
        checked_by = evidence.get("checked_by") or "—"
        checked_on = evidence.get("checked_on") or "—"
        if not evidence.get("checked_by") or any(
            rights.get(k) == "unknown"
            for k in (
                "use_research",
                "redistribute_raw",
                "redistribute_derived",
                "commercial_use",
                "attribution_required",
                "share_alike",
                "no_derivatives",
            )
        ):
            needing_human.append(source["id"])
        lines.append(
            "| {id} | {lic} | {ur} | {raw} | {der} | {com} | {att} | {sa} | {nd} | "
            "{by} | {on} |".format(
                id=source["id"],
                lic=rights.get("licence_id", "UNKNOWN"),
                ur=rights.get("use_research", "unknown"),
                raw=rights.get("redistribute_raw", "unknown"),
                der=rights.get("redistribute_derived", "unknown"),
                com=rights.get("commercial_use", "unknown"),
                att=rights.get("attribution_required", "unknown"),
                sa=rights.get("share_alike", "unknown"),
                nd=rights.get("no_derivatives", "unknown"),
                by=checked_by,
                on=checked_on,
            ),
        )

    lines.extend(
        [
            "",
            "## Variables (gate)",
            "",
            "| Variable | source_ids | decision | reasons |",
            "| --- | --- | --- | --- |",
        ],
    )

    for variable in catalog_data.get("variables", []):
        if not isinstance(variable, dict):
            continue
        result = gate_for_variable(variable, registry=registry, deployment=deploy)
        ids = ",".join(variable.get("source_ids") or [])
        reasons = "; ".join(result["reasons"]).replace("|", "\\|")
        lines.append(
            f"| {variable.get('id')} | {ids} | {result['decision']} | {reasons} |",
        )

    lines.extend(
        [
            "",
            "## Needs human rights check",
            "",
        ],
    )
    if needing_human:
        for sid in needing_human:
            lines.append(f"- `{sid}`")
    else:
        lines.append("- (none)")
    lines.append("")
    return "\n".join(lines)


def write_rights_md(
    *,
    path: Path | None = None,
) -> Path:
    target = path or rights_md_path()
    target.write_text(render_rights_md(), encoding="utf-8")
    return target
