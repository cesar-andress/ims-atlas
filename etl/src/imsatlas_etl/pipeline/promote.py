"""Promote a staging release to public or internal data/release trees."""

from __future__ import annotations

import json
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


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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

    return {
        "version": version,
        "path": str(dest),
        "audience": audience,
        "promoted_by": who,
        "promoted_at": manifest["promoted_at"],
    }
