"""Step 6: immutable SPEC §3 release under data/release/ (staging or public)."""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.pipeline.io_paths import (
    freshness_path,
    public_release_dir,
    staging_release_dir,
)
from imsatlas_etl.pipeline.release_tables import write_spec3_tables
from imsatlas_etl.rights import gate_for_variable, load_deployment
from imsatlas_etl.sources import sources_by_id

SHIP_DECISIONS = frozenset({"ship_raw", "ship_derived"})

# SPEC §3 size budgets
MAX_RELEASE_BYTES = 800 * 1024 * 1024
MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _iter_release_files(base: Path) -> list[Path]:
    skip = {
        "manifest.json",
        "CHANGELOG.md",
        "README.md",
        "LICENSES.md",
        "catalog.json",
    }
    files: list[Path] = []
    for path in sorted(base.rglob("*")):
        if path.is_file() and path.name not in skip:
            files.append(path)
    return files


def _source_versions(*, root: Path | None) -> dict[str, str]:
    path = freshness_path(root=root)
    if not path.is_file():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        row["source"]: str(row.get("ingested_version") or row.get("upstream_version"))
        for row in payload.get("sources", [])
    }


def _variable_gates() -> list[dict[str, Any]]:
    catalog = load_catalog()
    registry = sources_by_id()
    deployment = load_deployment()
    rows: list[dict[str, Any]] = []
    for variable in catalog["variables"]:
        result = gate_for_variable(
            variable,
            registry=registry,
            deployment=deployment,
        )
        decision = result["decision"]
        rows.append(
            {
                "id": variable["id"],
                "decision": decision,
                "included": decision in SHIP_DECISIONS,
                "reasons": result["reasons"],
                "share_alike": result.get("share_alike", False),
                "source_ids": list(variable.get("source_ids") or []),
            },
        )
    return rows


def _assert_no_denied_variable_columns(
    release_root: Path,
    gates: list[dict],
) -> None:
    denied = {g["id"] for g in gates if not g["included"]}
    for path in release_root.rglob("*.parquet"):
        frame = pd.read_parquet(path)
        if "variable_id" in frame.columns:
            leaked = set(frame["variable_id"].astype(str)) & denied
            if leaked:
                raise ValueError(
                    f"{path.relative_to(release_root)} contains non-ship "
                    f"variable_id values: {sorted(leaked)}",
                )
            continue
        columns = set(frame.columns.astype(str))
        leaked_cols = columns & denied
        if leaked_cols:
            raise ValueError(
                f"{path.relative_to(release_root)} contains non-ship variable "
                f"columns: {sorted(leaked_cols)}",
            )


def _enforce_size_budgets(release_root: Path) -> dict[str, int]:
    total = 0
    largest = 0
    largest_path = ""
    for path in release_root.rglob("*"):
        if not path.is_file():
            continue
        size = path.stat().st_size
        total += size
        if size > largest:
            largest = size
            largest_path = str(path.relative_to(release_root))
        if size > MAX_SINGLE_FILE_BYTES:
            raise ValueError(
                f"size budget exceeded: {path.relative_to(release_root)} "
                f"is {size} bytes (max {MAX_SINGLE_FILE_BYTES})",
            )
    if total > MAX_RELEASE_BYTES:
        raise ValueError(
            f"size budget exceeded: release is {total} bytes (max {MAX_RELEASE_BYTES})",
        )
    return {
        "total_bytes": total,
        "largest_bytes": largest,
        "largest_path": largest_path,
    }


def _write_catalog_json(dest: Path, included_ids: set[str]) -> None:
    catalog = load_catalog()
    shipped = [v for v in catalog["variables"] if v["id"] in included_ids]
    payload = {
        "factors": catalog.get("factors", []),
        "variables": shipped,
        "n_variables": len(shipped),
    }
    (dest / "catalog.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _write_licenses_md(dest: Path, gates: list[dict[str, Any]]) -> None:
    registry = sources_by_id()
    lines = [
        "# Release licences",
        "",
        "Only gate-approved (`ship_*`) variables are included in this release.",
        "",
        "| Variable | source_ids | Licence | Decision |",
        "| --- | --- | --- | --- |",
    ]
    for g in gates:
        if not g["included"]:
            continue
        licences = []
        for sid in g["source_ids"]:
            rights = (registry.get(sid) or {}).get("rights") or {}
            licences.append(str(rights.get("licence_id", "UNKNOWN")))
        lines.append(
            f"| {g['id']} | {','.join(g['source_ids'])} | "
            f"{'; '.join(licences) or 'UNKNOWN'} | {g['decision']} |",
        )
    if not any(g["included"] for g in gates):
        lines.append("| — | — | — | no shipped variables |")
    lines.append("")
    (dest / "LICENSES.md").write_text("\n".join(lines), encoding="utf-8")


def _write_readme(dest: Path, version: str, counts: dict[str, Any]) -> None:
    text = f"""# IMS Atlas data release v{version}

## Cite

See the repository [CITATION.cff](https://github.com/cesar-andress/ims-atlas/blob/main/CITATION.cff).
Companion engine: [ims-backtest](https://github.com/cesar-andress/ims-backtest).

## Contents (SPEC §3)

| Path | Description | Rows |
| --- | --- | ---: |
| `country_year.parquet` | Long country panel | {counts.get("country_year_rows", 0)} |
| `bilateral_year.parquet` | Long bilateral | {counts.get("bilateral_year_rows", 0)} |
| `trade/hs2=*/part.parquet` | Trade by HS2 | {counts.get("trade_rows", 0)} |
| `catalog.json` | Shipped variables only | |
| `manifest.json` | Hashes, versions, gate decisions | |
| `LICENSES.md` | Licences for shipped vars | |

## Column dictionary

### country_year / bilateral_year

- `variable_id`: catalog id
- `value`: numeric observation
- `flag_imputed` / `flag_locf`: boolean; true only when imputation/LOCF was applied

### trade parts

- `exporter`, `importer`: ISO3
- `year`: integer
- `value_usd`: trade value

## Gate

Variables with decision `byod_only` or `local_only` are **not** included. Users may
upload BYOD CSV locally in the app (never uploaded to a server).
"""
    (dest / "README.md").write_text(text, encoding="utf-8")


def build_changelog(
    version: str,
    *,
    previous: Path | None,
    gates: list[dict[str, Any]],
) -> str:
    lines = [
        f"# Changelog — v{version}",
        "",
        f"Generated: {_now_iso()}",
        "",
    ]
    included = [g["id"] for g in gates if g["included"]]
    excluded = [g["id"] for g in gates if not g["included"]]
    lines.append(f"Included variables ({len(included)}): {', '.join(included) or '—'}")
    lines.append("")
    lines.append(
        f"Excluded by gate ({len(excluded)}): {', '.join(excluded) or '—'}",
    )
    lines.append("")
    if previous is None or not previous.is_dir():
        lines.append("Previous release: none (first release).")
    else:
        lines.append(f"Previous release directory: `{previous.name}`.")
    lines.append("")
    return "\n".join(lines)


def _previous_public(version: str, *, root: Path | None) -> Path | None:
    public = public_release_dir(root=root)
    if not public.is_dir():
        return None
    versions = sorted(
        p for p in public.iterdir() if p.is_dir() and p.name.startswith("v")
    )
    if not versions:
        return None
    current_name = f"v{version}"
    older = [p for p in versions if p.name != current_name]
    return older[-1] if older else None


def _row_count(path: Path) -> int | None:
    if path.suffix != ".parquet":
        return None
    return int(len(pd.read_parquet(path)))


def run_release(
    version: str,
    *,
    root: Path | None = None,
    staging: bool = True,
    force: bool = False,
) -> dict[str, Any]:
    """
    Build SPEC §3 release tree from curated/.

    Default writes to data/release/staging/vX.Y.Z/. Use promote to publish.
    """
    dest_parent = (
        staging_release_dir(root=root) if staging else public_release_dir(root=root)
    )
    dest = dest_parent / f"v{version}"
    if dest.exists() and not force:
        raise FileExistsError(f"release exists: {dest} (use --force)")
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)

    gates = _variable_gates()
    included_ids = {g["id"] for g in gates if g["included"]}
    counts = write_spec3_tables(dest, root=root, included_ids=included_ids)
    _write_catalog_json(dest, included_ids)
    _write_licenses_md(dest, gates)
    _write_readme(dest, version, counts)

    _assert_no_denied_variable_columns(dest, gates)
    sizes = _enforce_size_budgets(dest)

    files_meta: list[dict[str, Any]] = []
    for path in _iter_release_files(dest):
        rel = str(path.relative_to(dest)).replace("\\", "/")
        share = [g for g in gates if g["included"] and g.get("share_alike")]
        licence = "SEE-MANIFEST-VARIABLES" if share else "pipeline-curated"
        files_meta.append(
            {
                "path": rel,
                "sha256": _sha256_file(path),
                "bytes": path.stat().st_size,
                "rows": _row_count(path),
                "licence": licence,
            },
        )

    previous = _previous_public(version, root=root)
    changelog = build_changelog(version, previous=previous, gates=gates)
    (dest / "CHANGELOG.md").write_text(changelog, encoding="utf-8")

    manifest = {
        "version": version,
        "created_at": _now_iso(),
        "staging": staging,
        "spec": "SPEC §3",
        "source_versions": _source_versions(root=root),
        "variables": gates,
        "files": files_meta,
        "n_included_variables": len(included_ids),
        "row_counts": counts,
        "size_bytes": sizes,
        "budgets": {
            "max_release_bytes": MAX_RELEASE_BYTES,
            "max_single_file_bytes": MAX_SINGLE_FILE_BYTES,
        },
    }
    (dest / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return {
        "path": str(dest),
        "version": version,
        "staging": staging,
        "n_files": len(files_meta),
        "n_included_variables": len(included_ids),
        "manifest": manifest,
        "size_bytes": sizes,
    }


def rebuild_release_bytes(
    version: str,
    *,
    root: Path | None = None,
    staging: bool = True,
) -> dict[str, str]:
    """Rebuild twice; data file digests must match (manifest timestamps may differ)."""
    first = run_release(version, root=root, staging=staging, force=True)
    sha1 = _sha256_file(Path(first["path"]) / "manifest.json")
    second = run_release(version, root=root, staging=staging, force=True)
    sha2 = _sha256_file(Path(second["path"]) / "manifest.json")
    files1 = {f["path"]: f["sha256"] for f in first["manifest"]["files"]}
    files2 = {f["path"]: f["sha256"] for f in second["manifest"]["files"]}
    if files1 != files2:
        raise AssertionError("release rebuild produced different file digests")
    return {
        "data_files_identical": "true",
        "manifest_sha_first": sha1,
        "manifest_sha_second": sha2,
    }


def list_release_variable_columns(release_root: Path) -> set[str]:
    cols: set[str] = set()
    for path in release_root.rglob("*.parquet"):
        frame = pd.read_parquet(path)
        if "variable_id" in frame.columns:
            cols.update(frame["variable_id"].astype(str))
        else:
            cols.update(frame.columns.astype(str))
    return cols


def write_zenodo_dataset_json(
    *,
    version: str,
    path: Path | None = None,
) -> Path:
    """Write .zenodo.dataset.json for the data release deposit."""
    from imsatlas_etl.paths import repo_root

    target = path or (repo_root() / ".zenodo.dataset.json")
    registry = sources_by_id()
    licence_notes = sorted(
        {
            f"{sid}:{(s.get('rights') or {}).get('licence_id', 'UNKNOWN')}"
            for sid, s in registry.items()
        },
    )
    payload = {
        "upload_type": "dataset",
        "title": f"IMS Atlas data release v{version}",
        "description": (
            "Versioned open data release for IMS Atlas "
            "(country-year, bilateral-year, and trade tables). "
            "Only variables that pass the licence gate are included. "
            "Companion dataset to ims-atlas and ims-backtest."
        ),
        "license": "other-open",
        "creators": [
            {
                "name": "Andrés, César",
                "orcid": "0009-0001-8968-3404",
                "affiliation": "Universidad Internacional de La Rioja",
            },
        ],
        "keywords": [
            "international market selection",
            "open data",
            "trade statistics",
            "governance indicators",
        ],
        "related_identifiers": [
            {
                "identifier": "https://github.com/cesar-andress/ims-atlas",
                "relation": "isSupplementTo",
                "resource_type": "software",
                "scheme": "url",
            },
            {
                "identifier": "https://github.com/cesar-andress/ims-backtest",
                "relation": "isSupplementTo",
                "resource_type": "software",
                "scheme": "url",
            },
        ],
        "notes": "Per-source licences: " + "; ".join(licence_notes),
        "version": version,
    }
    target.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return target
