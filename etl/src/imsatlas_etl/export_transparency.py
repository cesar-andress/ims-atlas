"""Export status + release manifest into app/public for SPA transparency views."""

from __future__ import annotations

import csv
import json
import shutil
from pathlib import Path
from typing import Any

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.paths import repo_root
from imsatlas_etl.sources import load_sources


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _latest_run(runs_dir: Path) -> Path | None:
    if not runs_dir.is_dir():
        return None
    files = sorted(runs_dir.glob("*.json"))
    return files[-1] if files else None


def _coverage_matrices(coverage_dir: Path) -> dict[str, dict[str, dict[str, int]]]:
    """Parse ETL coverage CSVs → {var_id: {iso3: {year: 0|1}}}."""
    out: dict[str, dict[str, dict[str, int]]] = {}
    if not coverage_dir.is_dir():
        return out
    for path in sorted(coverage_dir.glob("*_coverage.csv")):
        var_id = path.name[: -len("_coverage.csv")]
        with path.open(encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            if not reader.fieldnames or "iso3" not in reader.fieldnames:
                continue
            years = [c for c in reader.fieldnames if c != "iso3"]
            matrix: dict[str, dict[str, int]] = {}
            for row in reader:
                iso = str(row["iso3"])
                matrix[iso] = {
                    y: int(row[y]) if str(row.get(y, "")).strip() != "" else 0
                    for y in years
                }
            out[var_id] = matrix
    return out


def _sources_payload(
    freshness: dict[str, Any],
    manifest: dict[str, Any] | None,
) -> dict[str, Any]:
    fresh_by = {
        str(row["source"]): row
        for row in freshness.get("sources", [])
        if isinstance(row, dict) and "source" in row
    }
    versions = (manifest or {}).get("source_versions") or {}
    rows: list[dict[str, Any]] = []
    for src in load_sources().get("sources") or []:
        if not isinstance(src, dict) or "id" not in src:
            continue
        sid = str(src["id"])
        rights = src.get("rights") or {}
        evidence = rights.get("evidence") or {}
        endpoints = []
        for ep in src.get("endpoints") or []:
            endpoints.append(
                {
                    "id": ep.get("id"),
                    "template": ep.get("template"),
                    "method": ep.get("method"),
                    "notes": ep.get("notes"),
                },
            )
        fr = fresh_by.get(sid) or {}
        rows.append(
            {
                "id": sid,
                "publisher": src.get("publisher"),
                "landing_url": src.get("landing_url"),
                "terms_url": src.get("terms_url"),
                "licence_url": src.get("licence_url"),
                "update_cadence": src.get("update_cadence"),
                "version_detection": src.get("version_detection"),
                "citation": src.get("citation"),
                "endpoints": endpoints,
                "rights": {
                    "licence_id": rights.get("licence_id"),
                    "use_research": rights.get("use_research"),
                    "redistribute_raw": rights.get("redistribute_raw"),
                    "redistribute_derived": rights.get("redistribute_derived"),
                    "commercial_use": rights.get("commercial_use"),
                    "attribution_required": rights.get("attribution_required"),
                    "share_alike": rights.get("share_alike"),
                    "no_derivatives": rights.get("no_derivatives"),
                    "evidence": {
                        "checked_by": evidence.get("checked_by"),
                        "checked_on": evidence.get("checked_on"),
                        "terms_url": evidence.get("terms_url"),
                        "snapshot_sha256": evidence.get("snapshot_sha256"),
                        "note": evidence.get("note"),
                    },
                },
                "freshness": {
                    "checked_at": fr.get("checked_at"),
                    "upstream_changed_at": fr.get("upstream_changed_at"),
                    "ingested_version": fr.get("ingested_version"),
                    "upstream_version": fr.get("upstream_version"),
                    "stale": fr.get("stale"),
                    "mode": fr.get("mode"),
                },
                "release_version": versions.get(sid),
            },
        )
    return {
        "schema": "transparency-sources/v1",
        "generated_from": (
            "catalog/sources.yaml + status/freshness.json + release manifest"
        ),
        "sources": rows,
        "n_sources": len(rows),
    }


def _variables_payload(
    manifest: dict[str, Any] | None,
    coverage: dict[str, dict[str, dict[str, int]]],
) -> dict[str, Any]:
    catalog = load_catalog()
    gates = {
        str(g["id"]): g
        for g in (manifest or {}).get("variables", [])
        if isinstance(g, dict) and "id" in g
    }
    rows: list[dict[str, Any]] = []
    for var in catalog["variables"]:
        vid = str(var["id"])
        gate = gates.get(vid)
        rows.append(
            {
                "id": vid,
                "name": var.get("name"),
                "factor": var.get("factor"),
                "direction": var.get("direction"),
                "status": var.get("status"),
                "redistributable": var.get("redistributable"),
                "byod_only": var.get("byod_only"),
                "source_ids": list(var.get("source_ids") or []),
                "years": var.get("years"),
                "citation": var.get("citation"),
                "formula": var.get("formula"),
                "definition": var.get("definition"),
                "gate": gate,
                "coverage": coverage.get(vid),
                "download_allowed": bool(gate and gate.get("included")),
            },
        )
    return {
        "schema": "transparency-variables/v1",
        "generated_from": "catalog/variables.yaml + release manifest + status/coverage",
        "variables": rows,
        "n_variables": len(rows),
    }


def write_transparency_bundle(
    *,
    release_version: str | None = None,
) -> dict[str, str]:
    root = repo_root()
    status_src = root / "status"
    public_status = root / "app" / "public" / "status"
    public_status.mkdir(parents=True, exist_ok=True)

    freshness = _read_json(status_src / "freshness.json")
    qa = _read_json(status_src / "qa.json")
    lineage = _read_json(status_src / "lineage.json")

    _write_json(public_status / "freshness.json", freshness)
    _write_json(public_status / "qa.json", qa)
    _write_json(public_status / "lineage.json", lineage)

    latest = _latest_run(status_src / "runs")
    run_payload: dict[str, Any] | None = None
    if latest is not None:
        run_payload = _read_json(latest)
        runs_out = public_status / "runs"
        runs_out.mkdir(parents=True, exist_ok=True)
        shutil.copy2(latest, runs_out / latest.name)
        _write_json(public_status / "runs" / "latest.json", run_payload)
        _write_json(status_src / "runs" / "latest.json", run_payload)

    current_ptr = (
        (root / "data" / "release" / "public" / "CURRENT")
        .read_text(
            encoding="utf-8",
        )
        .strip()
    )
    raw_version = release_version or current_ptr or "1.0.0"
    version = raw_version[1:] if raw_version.startswith("v") else raw_version
    manifest_path = (
        root / "data" / "release" / "public" / f"v{version}" / "manifest.json"
    )
    manifest: dict[str, Any] | None = None
    if manifest_path.is_file():
        manifest = _read_json(manifest_path)
        dest_rel = root / "app" / "public" / "data" / f"v{version}"
        dest_rel.mkdir(parents=True, exist_ok=True)
        shutil.copy2(manifest_path, dest_rel / "manifest.json")
        # Also mirror CHANGELOG/README when present (text, not invented).
        for name in ("CHANGELOG.md", "README.md", "LICENSES.md"):
            src = manifest_path.parent / name
            if src.is_file():
                shutil.copy2(src, dest_rel / name)
        (root / "app" / "public" / "data" / "CURRENT").write_text(
            f"{version}\n",
            encoding="utf-8",
        )

    coverage = _coverage_matrices(status_src / "coverage")
    sources = _sources_payload(freshness, manifest)
    variables = _variables_payload(manifest, coverage)

    releases = {
        "schema": "transparency-releases/v1",
        "current": version,
        "releases": [
            {
                "version": version,
                "created_at": (manifest or {}).get("created_at"),
                "promoted_at": (manifest or {}).get("promoted_at"),
                "promoted_by": (manifest or {}).get("promoted_by"),
                "n_included_variables": (manifest or {}).get("n_included_variables"),
                "row_counts": (manifest or {}).get("row_counts"),
                "size_bytes": (manifest or {}).get("size_bytes"),
                "manifest_path": f"/data/v{version}/manifest.json",
            },
        ],
    }

    index = {
        "schema": "transparency-index/v1",
        "paths": {
            "freshness": "/status/freshness.json",
            "qa": "/status/qa.json",
            "lineage": "/status/lineage.json",
            "latest_run": "/status/runs/latest.json",
            "sources": "/status/sources.json",
            "variables": "/status/variables.json",
            "releases": "/status/releases.json",
            "manifest": f"/data/v{version}/manifest.json",
        },
        "current_release": version,
        "freshness_generated_at": freshness.get("generated_at"),
        "qa_status": qa.get("status"),
        "qa_n_warn": qa.get("n_warn"),
        "qa_n_block": qa.get("n_block"),
        "latest_run_id": (run_payload or {}).get("run_id"),
        "latest_run_status": (run_payload or {}).get("status"),
        "n_sources": sources["n_sources"],
        "n_variables": variables["n_variables"],
        "n_lineage_edges": len(lineage.get("edges") or []),
    }

    for name, payload in (
        ("sources.json", sources),
        ("variables.json", variables),
        ("releases.json", releases),
        ("index.json", index),
    ):
        _write_json(public_status / name, payload)
        # Host nginx serves /status/ from repo status/ (not app/dist).
        _write_json(status_src / name, payload)

    return {
        "status_dir": str(public_status),
        "release_version": version,
        "n_sources": str(sources["n_sources"]),
        "n_variables": str(variables["n_variables"]),
    }
