"""Step 6: immutable release under data/release/ (staging or public)."""

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
    curated_dir,
    freshness_path,
    public_release_dir,
    staging_release_dir,
)
from imsatlas_etl.rights import gate_for_variable, load_deployment
from imsatlas_etl.sources import sources_by_id

SHIP_DECISIONS = frozenset({"ship_raw", "ship_derived"})


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _iter_release_files(base: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(base.rglob("*")):
        if path.is_file() and path.name not in {"manifest.json", "CHANGELOG.md"}:
            files.append(path)
    return files


def _copy_curated(src: Path, dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        target = dest / item.name
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)


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


def _strip_non_ship_variable_columns(
    release_root: Path,
    gates: list[dict],
) -> None:
    """Drop BYOD / non-ship variable id columns before publishing."""
    denied = {g["id"] for g in gates if not g["included"]}
    path = release_root / "variables_country_year.parquet"
    if not path.is_file() or not denied:
        return
    frame = pd.read_parquet(path)
    keep = [c for c in frame.columns if c not in denied]
    frame[keep].to_parquet(path, index=False)
    meta_path = release_root / "variables_country_year.meta.json"
    if meta_path.is_file():
        meta_path.unlink()


def _assert_no_denied_variable_columns(release_root: Path, gates: list[dict]) -> None:
    """Fail if a released parquet contains a column equal to a non-ship variable id."""
    denied = {g["id"] for g in gates if not g["included"]}
    allowed = {g["id"] for g in gates if g["included"]}
    for path in release_root.rglob("*.parquet"):
        columns = set(pd.read_parquet(path).columns.astype(str))
        leaked = columns & denied
        if leaked:
            raise ValueError(
                f"{path.relative_to(release_root)} contains non-ship variable "
                f"columns: {sorted(leaked)}",
            )
        unexpected_ship = columns & allowed
        # Allowed variable ids may appear once rights allow shipping.
        _ = unexpected_ship


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
        prev_manifest = previous / "manifest.json"
        if prev_manifest.is_file():
            prev = json.loads(prev_manifest.read_text(encoding="utf-8"))
            lines.append(
                f"Previous file count: {len(prev.get('files', []))}.",
            )
    lines.append("")
    return "\n".join(lines)


def run_release(
    version: str,
    *,
    root: Path | None = None,
    staging: bool = True,
    force: bool = False,
) -> dict[str, Any]:
    """
    Build release tree from curated/.

    Default writes to data/release/staging/vX.Y.Z/. Use promote to publish.
    """
    cur = curated_dir(root=root)
    if not cur.is_dir():
        raise FileNotFoundError(f"missing curated dir {cur}")

    if staging:
        dest_parent = staging_release_dir(root=root)
    else:
        dest_parent = public_release_dir(root=root)
    dest = dest_parent / f"v{version}"
    if dest.exists() and not force:
        raise FileExistsError(f"release exists: {dest} (use --force)")
    _copy_curated(cur, dest)

    gates = _variable_gates()
    _strip_non_ship_variable_columns(dest, gates)
    _assert_no_denied_variable_columns(dest, gates)

    files_meta: list[dict[str, Any]] = []
    for path in _iter_release_files(dest):
        rel = str(path.relative_to(dest)).replace("\\", "/")
        # Per-file licence: share_alike vars noted in manifest
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
        "source_versions": _source_versions(root=root),
        "variables": gates,
        "files": files_meta,
        "n_included_variables": sum(1 for g in gates if g["included"]),
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
        "n_included_variables": manifest["n_included_variables"],
        "manifest": manifest,
    }


def _row_count(path: Path) -> int | None:
    if path.suffix != ".parquet":
        return None
    return int(len(pd.read_parquet(path)))


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


def rebuild_release_bytes(
    version: str,
    *,
    root: Path | None = None,
    staging: bool = True,
) -> dict[str, str]:
    """Rebuild twice and return sha256 of each manifest (must match)."""
    first = run_release(version, root=root, staging=staging, force=True)
    sha1 = _sha256_file(Path(first["path"]) / "manifest.json")
    # Clear timestamps for byte-identical: rebuild curated copy again then compare files
    second = run_release(version, root=root, staging=staging, force=True)
    sha2 = _sha256_file(Path(second["path"]) / "manifest.json")
    # Manifest includes created_at so hashes differ — compare data file digests instead.
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
        cols.update(pd.read_parquet(path).columns.astype(str))
    return cols
