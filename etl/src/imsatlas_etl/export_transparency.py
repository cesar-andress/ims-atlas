"""Export status + release manifest into app/public for SPA transparency views."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

from imsatlas_etl.access import source_store, source_store_reason
from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.changes import (
    changes_dir,
    read_history,
    readable_source_summary,
    variables_status_fields,
)
from imsatlas_etl.pipeline.terms import terms_changed_for_source
from imsatlas_etl.sources import load_sources

FIXTURE_BANNER = (
    "Fixture pipeline artefact (mini_world test data). "
    "Not a live ingest and not a production data release."
)
_FIXTURE_MARKERS = re.compile(
    r'"mode": "fixture"|"fixture_mode": true|"is_fixture": true|"mini-',
)


def payload_is_fixture(payload: object) -> bool:
    """True when a status payload carries fixture-mode or mini-world markers."""
    return bool(_FIXTURE_MARKERS.search(json.dumps(payload, sort_keys=True)))


def with_fixture_flag(payload: dict[str, Any], is_fixture: bool) -> dict[str, Any]:
    """Copy of ``payload`` with an explicit ``is_fixture`` flag (+ banner text)."""
    out = {k: v for k, v in payload.items() if k != "fixture_banner"}
    out["is_fixture"] = is_fixture
    if is_fixture:
        out["fixture_banner"] = FIXTURE_BANNER
    return out


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
                    "terms_changed": terms_changed_for_source(src),
                },
                "release_version": versions.get(sid),
                "store": source_store(rights),
                "store_reason": source_store_reason(rights),
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
    freshness: dict[str, Any],
    *,
    root: Path,
) -> dict[str, Any]:
    catalog = load_catalog()
    status_fields = variables_status_fields(
        catalog["variables"],
        freshness,
        root=root,
    )
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
                **status_fields.get(vid, {}),
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

    latest = _latest_run(status_src / "runs")
    run_payload: dict[str, Any] | None = None
    if latest is not None:
        run_payload = _read_json(latest)

    # Fixture honesty: anything derived from a fixture-mode run or freshness is
    # flagged is_fixture:true in every public payload (SPEC: no fake "live").
    fixture = payload_is_fixture(freshness) or (
        run_payload is not None and payload_is_fixture(run_payload)
    )
    freshness = with_fixture_flag(freshness, fixture)
    for name, payload in (
        ("freshness.json", freshness),
        ("qa.json", with_fixture_flag(qa, fixture)),
        ("lineage.json", with_fixture_flag(lineage, fixture)),
    ):
        _write_json(public_status / name, payload)
        _write_json(status_src / name, payload)

    if latest is not None and run_payload is not None:
        runs_out = public_status / "runs"
        runs_out.mkdir(parents=True, exist_ok=True)
        flagged_run = with_fixture_flag(run_payload, payload_is_fixture(run_payload))
        _write_json(runs_out / latest.name, flagged_run)
        _write_json(runs_out / "latest.json", flagged_run)
        _write_json(status_src / "runs" / "latest.json", flagged_run)
    runs_out = public_status / "runs"
    for old in sorted(runs_out.glob("*.json")) if runs_out.is_dir() else []:
        if old.name in {latest.name if latest else "", "latest.json"}:
            continue
        old_payload = _read_json(old)
        _write_json(
            old, with_fixture_flag(old_payload, payload_is_fixture(old_payload))
        )

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
        _write_json(
            dest_rel / "manifest.json",
            with_fixture_flag(manifest, payload_is_fixture(manifest)),
        )
        # Also mirror CHANGELOG/README when present (text, not invented).
        for name in ("CHANGELOG.md", "README.md", "LICENSES.md"):
            src = manifest_path.parent / name
            if src.is_file():
                (dest_rel / name).write_bytes(src.read_bytes())
        (root / "app" / "public" / "data" / "CURRENT").write_text(
            f"{version}\n",
            encoding="utf-8",
        )

    coverage = _coverage_matrices(status_src / "coverage")
    bundle_fixture = fixture or (manifest is not None and payload_is_fixture(manifest))
    sources = with_fixture_flag(_sources_payload(freshness, manifest), bundle_fixture)
    variables = with_fixture_flag(
        _variables_payload(manifest, coverage, freshness, root=root),
        bundle_fixture,
    )

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

    history_rows = read_history(root=root)
    updates_runs: list[dict[str, Any]] = []
    changes_out = public_status / "changes"
    changes_out.mkdir(parents=True, exist_ok=True)
    src_changes = changes_dir(root=root)
    for entry in reversed(history_rows[-50:]):
        run_id = str(entry.get("run_id") or "")
        change_payload: dict[str, Any] | None = None
        change_path = src_changes / f"{run_id}.json" if run_id else None
        if change_path is not None and change_path.is_file():
            change_payload = _read_json(change_path)
            _write_json(
                changes_out / f"{run_id}.json",
                with_fixture_flag(
                    change_payload,
                    payload_is_fixture(change_payload) or bundle_fixture,
                ),
            )
        summaries: list[str] = []
        for sid, diff in ((change_payload or {}).get("sources") or {}).items():
            if isinstance(diff, dict):
                summaries.append(readable_source_summary(str(sid), diff))
        updates_runs.append(
            {
                "run_id": run_id,
                "mode": entry.get("mode"),
                "status": entry.get("status"),
                "started_at": entry.get("started_at"),
                "ended_at": entry.get("ended_at"),
                "summaries": summaries,
                "n_new_cells": entry.get("n_new_cells"),
                "n_revised_cells": entry.get("n_revised_cells"),
            },
        )
    updates = with_fixture_flag(
        {
            "schema": "transparency-updates/v1",
            "generated_from": "status/history.jsonl + status/changes/",
            "runs": updates_runs,
            "n_runs": len(updates_runs),
        },
        bundle_fixture,
    )
    history_public = with_fixture_flag(
        {
            "schema": "transparency-history/v1",
            "runs": history_rows[-200:],
            "n_runs": len(history_rows),
        },
        bundle_fixture,
    )

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
            "updates": "/status/updates.json",
            "history": "/status/history.json",
            "spot_check": "/status/spot_check.json",
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
        "n_history_runs": len(history_rows),
    }

    spot_src = status_src / "spot_check.json"
    if spot_src.is_file():
        spot_payload = with_fixture_flag(_read_json(spot_src), bundle_fixture)
    else:
        spot_payload = with_fixture_flag(
            {
                "schema": "spot-check/v1",
                "n": 0,
                "n_sampled": 0,
                "matches": 0,
                "mismatches": 0,
                "unreachable": 0,
                "samples": [],
                "note": "No spot-check run published yet.",
            },
            bundle_fixture,
        )
    index["spot_check_generated_at"] = spot_payload.get("generated_at")
    index["spot_check_matches"] = spot_payload.get("matches")
    index["spot_check_mismatches"] = spot_payload.get("mismatches")
    index["spot_check_unreachable"] = spot_payload.get("unreachable")

    # Integrity hints from the public manifest (may pre-date Phase D).
    signature = (manifest or {}).get("signature") or {
        "status": "unsigned",
        "note": "SHA256SUMS / signature fields appear on releases built after Phase D.",
    }
    releases = with_fixture_flag(
        {
            **releases,
            "signature": signature,
            "sha256sums_path": f"/data/v{version}/SHA256SUMS",
            "provenance_path": f"/data/v{version}/provenance.parquet",
        },
        bundle_fixture,
    )

    for name, payload in (
        ("sources.json", sources),
        ("variables.json", variables),
        ("releases.json", releases),
        ("updates.json", updates),
        ("history.json", history_public),
        ("spot_check.json", spot_payload),
        ("index.json", with_fixture_flag(index, bundle_fixture)),
    ):
        _write_json(public_status / name, payload)
        # Host nginx serves /status/ from repo status/ (not app/dist).
        _write_json(status_src / name, payload)

    return {
        "status_dir": str(public_status),
        "release_version": version,
        "n_sources": str(sources["n_sources"]),
        "n_variables": str(variables["n_variables"]),
        "is_fixture": str(bundle_fixture).lower(),
    }
