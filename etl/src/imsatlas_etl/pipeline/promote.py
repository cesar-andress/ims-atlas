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
from imsatlas_etl.pipeline.release_tables import MIN_COUNTRY_PRODUCT_CHAPTERS

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


def _normalize_version_dir(raw: str) -> str:
    text = raw.strip()
    if not text:
        return ""
    return text if text.startswith("v") else f"v{text}"


def country_product_chapters(release_dir: Path) -> int:
    """Count non-empty HS2 partitions under ``country_product/``."""
    base = release_dir / "country_product"
    if not base.is_dir():
        return 0
    return sum(
        1
        for path in base.iterdir()
        if path.is_dir() and path.name.startswith("hs2=") and "_empty" not in path.name
    )


def _best_full_sibling(
    dest_parent: Path,
    *,
    exclude: str | None = None,
) -> tuple[str, int] | None:
    best: tuple[str, int] | None = None
    if not dest_parent.is_dir():
        return None
    for path in dest_parent.iterdir():
        if not path.is_dir() or not _VERSION_DIR.match(path.name):
            continue
        if exclude and path.name == exclude:
            continue
        chapters = country_product_chapters(path)
        if chapters < MIN_COUNTRY_PRODUCT_CHAPTERS:
            continue
        if best is None or chapters > best[1] or (
            chapters == best[1] and _version_key(path.name) > _version_key(best[0])
        ):
            best = (path.name, chapters)
    return best


def _newest_full_release(dest_parent: Path) -> tuple[str, int] | None:
    newest: tuple[str, int] | None = None
    if not dest_parent.is_dir():
        return None
    for path in dest_parent.iterdir():
        if not path.is_dir() or not _VERSION_DIR.match(path.name):
            continue
        chapters = country_product_chapters(path)
        if chapters < MIN_COUNTRY_PRODUCT_CHAPTERS:
            continue
        if newest is None or _version_key(path.name) > _version_key(newest[0]):
            newest = (path.name, chapters)
    return newest


def assert_current_pointer_healthy(dest_parent: Path) -> str:
    """Refuse CURRENT at empty/_empty or lagging behind a newer full release."""
    current_path = dest_parent / "CURRENT"
    if not current_path.is_file():
        raise ValueError(f"missing CURRENT pointer under {dest_parent}")
    pointed = _normalize_version_dir(current_path.read_text(encoding="utf-8"))
    if not _VERSION_DIR.match(pointed):
        raise ValueError(f"invalid CURRENT value {pointed!r} under {dest_parent}")
    target = dest_parent / pointed
    if not target.is_dir():
        raise ValueError(f"CURRENT points at missing release {pointed}")
    chapters = country_product_chapters(target)
    empty_marker = (target / "country_product" / "hs2=_empty").is_dir()
    better = _best_full_sibling(dest_parent, exclude=pointed)
    if (chapters < MIN_COUNTRY_PRODUCT_CHAPTERS or empty_marker) and better is not None:
        raise ValueError(
            f"CURRENT -> {pointed} has {chapters} country_product chapters "
            f"(empty_marker={empty_marker}) but {better[0]} has {better[1]} "
            f"(refuse empty/old pointer)",
        )
    newest = _newest_full_release(dest_parent)
    if (
        newest is not None
        and _version_key(pointed) < _version_key(newest[0])
        and newest[1] >= MIN_COUNTRY_PRODUCT_CHAPTERS
    ):
        raise ValueError(
            f"CURRENT -> {pointed} but newer full release {newest[0]} "
            f"({newest[1]} chapters) exists (refuse stale pointer)",
        )
    return pointed


def assert_current_update_allowed(
    dest_parent: Path,
    version: str,
    *,
    candidate: Path | None = None,
    allow_pointer_demote: bool = False,
) -> None:
    """Refuse CURRENT demotion onto empty/older releases when a good newer one exists.

    ``candidate`` is the tree that would become CURRENT (staging before copy, or
    the promoted dest afterward). When omitted, ``dest_parent/v{version}`` is used.
    """
    tree = candidate if candidate is not None else dest_parent / f"v{version}"
    if not tree.is_dir():
        raise ValueError(f"cannot point CURRENT at missing release tree {tree}")
    chapters = country_product_chapters(tree)
    empty_marker = (tree / "country_product" / "hs2=_empty").is_dir()
    better = _best_full_sibling(dest_parent, exclude=f"v{version}")
    if (chapters < MIN_COUNTRY_PRODUCT_CHAPTERS or empty_marker) and better is not None:
        raise ValueError(
            f"refuse CURRENT -> v{version}: country_product has {chapters} chapters "
            f"(empty_marker={empty_marker}) but {better[0]} has {better[1]} chapters",
        )

    current_path = dest_parent / "CURRENT"
    if allow_pointer_demote or not current_path.is_file():
        return
    current_name = _normalize_version_dir(current_path.read_text(encoding="utf-8"))
    if not current_name or current_name == f"v{version}":
        return
    current_dir = dest_parent / current_name
    if not current_dir.is_dir():
        return
    current_chapters = country_product_chapters(current_dir)
    if (
        current_chapters >= MIN_COUNTRY_PRODUCT_CHAPTERS
        and _version_key(current_name) > _version_key(f"v{version}")
    ):
        raise ValueError(
            f"refuse CURRENT demotion from {current_name} "
            f"({current_chapters} chapters) to v{version}; "
            "pass allow_pointer_demote=True / --allow-pointer-demote to override",
        )


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
    allow_pointer_demote: bool = False,
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

    # Guard before destroying an existing tree / rewriting CURRENT.
    assert_current_update_allowed(
        dest_parent,
        version,
        candidate=staging,
        allow_pointer_demote=allow_pointer_demote,
    )

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

    # Re-check after copy (tree must match staging quality).
    assert_current_update_allowed(
        dest_parent,
        version,
        candidate=dest,
        allow_pointer_demote=allow_pointer_demote,
    )

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
