"""Promote a staging release to public or internal data/release trees."""

from __future__ import annotations

import json
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.integrity import write_sha256sums
from imsatlas_etl.pipeline.io_paths import (
    internal_release_dir,
    public_release_dir,
    staging_internal_release_dir,
    staging_release_dir,
)

# Keep the current release plus this many older version directories.
KEEP_RELEASE_VERSIONS = 3
_VERSION_DIR = re.compile(r"^v(\d+\.\d+\.\d+)$")


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _version_key(name: str) -> tuple[int, ...]:
    match = _VERSION_DIR.match(name)
    if not match:
        return (0, 0, 0)
    return tuple(int(part) for part in match.group(1).split("."))


def prune_old_releases(
    dest_parent: Path,
    *,
    keep: int = KEEP_RELEASE_VERSIONS,
) -> list[str]:
    """Delete oldest ``vX.Y.Z`` dirs beyond ``keep`` (never touch CURRENT)."""
    versions = sorted(
        (
            path
            for path in dest_parent.iterdir()
            if path.is_dir() and _VERSION_DIR.match(path.name)
        ),
        key=lambda path: _version_key(path.name),
    )
    removed: list[str] = []
    while len(versions) > keep:
        old = versions.pop(0)
        shutil.rmtree(old)
        removed.append(old.name)
    return removed


def promote_release(
    version: str,
    *,
    by: str,
    root: Path | None = None,
    force: bool = False,
    audience: str = "public",
) -> dict[str, Any]:
    who = by.strip()
    if not who:
        raise ValueError("--by must be a non-empty human name")
    if audience not in ("public", "internal"):
        raise ValueError(f"audience must be public|internal, got {audience!r}")

    if audience == "internal":
        staging = staging_internal_release_dir(root=root) / f"v{version}"
        dest_parent = internal_release_dir(root=root)
    else:
        staging = staging_release_dir(root=root) / f"v{version}"
        dest_parent = public_release_dir(root=root)

    if not staging.is_dir():
        raise FileNotFoundError(f"staging release not found: {staging}")

    dest_parent.mkdir(parents=True, exist_ok=True)
    dest = dest_parent / f"v{version}"
    if dest.exists() and not force:
        raise FileExistsError(f"{audience} release exists: {dest} (use --force)")

    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(staging, dest)

    manifest_path = dest / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["staging"] = False
    manifest["audience"] = audience
    manifest["promoted_by"] = who
    manifest["promoted_at"] = _now_iso()
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    # manifest.json changed: SHA256SUMS must cover the promoted bytes.
    write_sha256sums(dest)

    # Pointer to current release for this audience
    current = dest_parent / "CURRENT"
    current.write_text(f"v{version}\n", encoding="utf-8")

    pruned = prune_old_releases(dest_parent)

    return {
        "version": version,
        "path": str(dest),
        "audience": audience,
        "promoted_by": who,
        "promoted_at": manifest["promoted_at"],
        "pruned": pruned,
    }
