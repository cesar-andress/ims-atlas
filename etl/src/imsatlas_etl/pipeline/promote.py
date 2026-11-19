"""Promote a staging release to the public data/release/vX.Y.Z/ tree."""

from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.integrity import write_sha256sums
from imsatlas_etl.pipeline.io_paths import public_release_dir, staging_release_dir


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def promote_release(
    version: str,
    *,
    by: str,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    who = by.strip()
    if not who:
        raise ValueError("--by must be a non-empty human name")

    staging = staging_release_dir(root=root) / f"v{version}"
    if not staging.is_dir():
        raise FileNotFoundError(f"staging release not found: {staging}")

    public_parent = public_release_dir(root=root)
    public_parent.mkdir(parents=True, exist_ok=True)
    dest = public_parent / f"v{version}"
    if dest.exists() and not force:
        raise FileExistsError(f"public release exists: {dest} (use --force)")

    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(staging, dest)

    manifest_path = dest / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["staging"] = False
    manifest["promoted_by"] = who
    manifest["promoted_at"] = _now_iso()
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    # manifest.json changed: SHA256SUMS must cover the promoted bytes.
    write_sha256sums(dest)

    # Pointer to current public release
    current = public_parent / "CURRENT"
    current.write_text(f"v{version}\n", encoding="utf-8")

    return {
        "version": version,
        "path": str(dest),
        "promoted_by": who,
        "promoted_at": manifest["promoted_at"],
    }
