"""Step 6: immutable SPEC §3 release under data/release/ (staging or public)."""

from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.gate import evidence_present
from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.integrity import (
    sha256_file,
    signature_block,
    write_sha256sums,
)
from imsatlas_etl.pipeline.io_paths import (
    freshness_path,
    internal_release_dir,
    public_release_dir,
    staging_internal_release_dir,
    staging_release_dir,
)
from imsatlas_etl.pipeline.provenance import build_provenance_for_release
from imsatlas_etl.pipeline.release_tables import write_spec3_tables
from imsatlas_etl.rights import gate_for_variable, load_deployment
from imsatlas_etl.sources import sources_by_id

SHIP_DECISIONS = frozenset({"ship_raw", "ship_derived"})
Audience = str  # "public" | "internal"

# SPEC §3 size budgets
MAX_RELEASE_BYTES = 800 * 1024 * 1024
MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _sha256_file(path: Path) -> str:
    return sha256_file(path)


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


def _use_research_ok(variable: dict[str, Any], registry: dict[str, Any]) -> bool:
    """True when every source has use_research=yes and complete evidence."""
    sids = list(variable.get("source_ids") or [])
    if not sids:
        return False
    for sid in sids:
        rights = (registry.get(str(sid)) or {}).get("rights") or {}
        if rights.get("use_research") != "yes":
            return False
        if not evidence_present(rights):
            return False
    return True


def _variable_gates(*, audience: Audience = "public") -> list[dict[str, Any]]:
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
        if audience == "public":
            included = decision in SHIP_DECISIONS
        else:
            # Internal (CERRADO): ship_* or research-use with evidence (SPEC §13).
            included = decision in SHIP_DECISIONS or (
                decision != "local_only" and _use_research_ok(variable, registry)
            )
        rows.append(
            {
                "id": variable["id"],
                "decision": decision,
                "included": included,
                "audience": audience,
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
        # Phase H: one HS nomenclature per release (BACI HS revision used upstream).
        "hs_nomenclature": {
            "revision": "HS2017",
            "note": (
                "Product codes in trade/ and country_product/ follow the HS revision "
                "of the BACI extract pinned for this release. Codes that changed "
                "across revisions are not remapped; treat cross-revision time series "
                "with care."
            ),
            "concordance": "none",
        },
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
    n_cy = counts.get("country_year_rows", 0)
    n_bi = counts.get("bilateral_year_rows", 0)
    n_tr = counts.get("trade_rows", 0)
    n_cp = counts.get("country_product_rows", 0)
    n_pr = counts.get("provenance_rows", 0)
    text = f"""# IMS Atlas data release v{version}

## Cite

See the repository [CITATION.cff](https://github.com/cesar-andress/ims-atlas/blob/main/CITATION.cff).
Companion engine: [ims-backtest](https://github.com/cesar-andress/ims-backtest).

## Contents (SPEC §3)

| Path | Description | Rows |
| --- | --- | ---: |
| `country_year.parquet` | Long country panel | {n_cy} |
| `bilateral_year.parquet` | Long bilateral | {n_bi} |
| `trade/hs2=*/part.parquet` | Trade by HS2 | {n_tr} |
| `country_product/hs2=*/` | Product metrics by HS2 | {n_cp} |
| `provenance.parquet` | One row per release cell | {n_pr} |
| `provenance.jsonl` | Same rows as JSON lines (tiny releases only) | |
| `catalog.json` | Shipped variables + HS nomenclature | |
| `manifest.json` | Hashes, versions, gate decisions, signature status | |
| `SHA256SUMS` | `sha256sum` digests of every other file | |
| `LICENSES.md` | Licences for shipped vars | |

## Column dictionary

### country_year / bilateral_year

- `variable_id`: catalog id
- `value`: numeric observation
- `flag_imputed` / `flag_locf`: boolean; true only when imputation/LOCF was applied

### provenance

One row per cell of `country_year` / `bilateral_year`: `table`, entity ids,
`year`, `variable_id`, `source_id`, `upstream_code`, `upstream_version`,
`request_url_or_file`, `row_key`, `raw_sha256`, `transform_steps`,
`flag_imputed`, `flag_locf`, `flag_unit_converted`, `flag_iso3_remap`, `value`.
Verify integrity with `atlas-etl verify-release <dir>`.

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
    out_dir: Path | None = None,
    audience: Audience = "public",
) -> dict[str, Any]:
    """
    Build SPEC §3 release tree from curated/.

    Default writes to data/release/staging/vX.Y.Z/ (public audience).
    ``audience=internal`` writes staging/internal/vX.Y.Z (research-use scope).
    ``out_dir`` overrides the destination directory (used by reproduce-release
    so a reference release is never overwritten).
    """
    if audience not in ("public", "internal"):
        raise ValueError(f"audience must be public|internal, got {audience!r}")
    if out_dir is not None:
        dest = out_dir
    elif audience == "internal":
        dest_parent = (
            staging_internal_release_dir(root=root)
            if staging
            else internal_release_dir(root=root)
        )
        dest = dest_parent / f"v{version}"
    else:
        dest_parent = (
            staging_release_dir(root=root) if staging else public_release_dir(root=root)
        )
        dest = dest_parent / f"v{version}"
    if dest.exists() and not force:
        raise FileExistsError(f"release exists: {dest} (use --force)")
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)

    gates = _variable_gates(audience=audience)
    included_ids = {g["id"] for g in gates if g["included"]}
    counts = write_spec3_tables(dest, root=root, included_ids=included_ids)
    counts["provenance_rows"] = build_provenance_for_release(dest, root=root)[
        "provenance_rows"
    ]
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
        "audience": audience,
        "spec": "SPEC §3",
        "source_versions": _source_versions(root=root),
        "variables": gates,
        "files": files_meta,
        "n_included_variables": len(included_ids),
        "signature": signature_block(version, repo=repo_root()),
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
    write_sha256sums(dest)
    return {
        "path": str(dest),
        "version": version,
        "staging": staging,
        "audience": audience,
        "n_files": len(files_meta),
        "n_included_variables": len(included_ids),
        "manifest": manifest,
        "size_bytes": sizes,
    }


def write_dual_release_report(
    version: str,
    *,
    public_result: dict[str, Any],
    internal_result: dict[str, Any],
    root: Path | None = None,
) -> Path:
    """Write status/release_report_vX.Y.Z.md (Phase R dual staging summary)."""
    from imsatlas_etl.pipeline.io_paths import status_root

    out_dir = status_root(root=root)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"release_report_v{version}.md"

    def _section(label: str, result: dict[str, Any]) -> list[str]:
        manifest = result.get("manifest") or {}
        gates = list(manifest.get("variables") or [])
        included = [g["id"] for g in gates if g.get("included")]
        excluded = [
            f"{g['id']} ({g.get('decision')}: "
            f"{'; '.join(g.get('reasons') or []) or '—'})"
            for g in gates
            if not g.get("included")
        ]
        sizes = result.get("size_bytes") or {}
        budgets = manifest.get("budgets") or {}
        lines = [
            f"## {label}",
            "",
            f"- Path: `{result.get('path')}`",
            f"- Included variables ({len(included)}): "
            f"{', '.join(included) or '(none — empty release)'}",
            f"- Excluded ({len(excluded)}):",
        ]
        for row in excluded:
            lines.append(f"  - {row}")
        lines.extend(
            [
                f"- Files: {result.get('n_files')}",
                f"- Total bytes: {sizes.get('total_bytes', 0)} "
                f"(budget {budgets.get('max_release_bytes', '—')})",
                f"- Largest file: {sizes.get('largest_file_bytes', 0)} "
                f"({sizes.get('largest_file', '—')})",
                "",
            ],
        )
        return lines

    qa_path = status_root(root=root) / "qa.json"
    qa_summary = "QA status file missing (run `atlas-etl qa`)."
    if qa_path.is_file():
        qa = json.loads(qa_path.read_text(encoding="utf-8"))
        qa_summary = (
            f"status={qa.get('status')} warn={qa.get('n_warn')} "
            f"block={qa.get('n_block')}"
        )

    cov_dir = status_root(root=root) / "coverage"
    cov_n = len(list(cov_dir.glob("*_coverage.csv"))) if cov_dir.is_dir() else 0

    body = "\n".join(
        [
            f"# Dual release report v{version}",
            "",
            "Phase R staging (SPEC §13). Public ships only `ship_*`; "
            "internal may include `use_research=yes` with evidence.",
            "",
            f"- QA: {qa_summary}",
            f"- Coverage CSVs present: {cov_n}",
            "",
            *_section("Public audience", public_result),
            *_section("Internal audience", internal_result),
            "## Human gate (blocked until César confirms)",
            "",
            "No source has a completed `rights-verify` with redistribute or "
            "use_research evidence. Do **not** mark sources verified in Cursor.",
            "After RIGHTS.md diff + OK: re-run dual staging, promote, and "
            "rebuild COL/HS64 demo from the release that has cells.",
            "",
        ],
    )
    path.write_text(body, encoding="utf-8")
    return path


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
                "name": "Baena-Rojas, Jose Jaime",
                "orcid": "0000-0002-0915-4087",
                "affiliation": (
                    "Pontificia Universidad Católica del Perú; "
                    "Universidad Internacional de La Rioja"
                ),
            },
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
