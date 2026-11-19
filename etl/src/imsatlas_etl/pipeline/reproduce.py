"""reproduce-release: rebuild a release and diff it against a reference tree."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.integrity import list_release_files, sha256_file
from imsatlas_etl.pipeline.io_paths import public_release_dir, staging_release_dir
from imsatlas_etl.pipeline.release import run_release
from imsatlas_etl.pipeline.runner import run_pipeline

# Carry build timestamps or build-environment state; compared semantically.
VOLATILE_FILES = frozenset({"manifest.json", "CHANGELOG.md", "SHA256SUMS"})
VOLATILE_MANIFEST_KEYS = frozenset(
    {"created_at", "promoted_at", "promoted_by", "staging", "signature"},
)
# Derived from the per-file comparison; not compared as manifest fields.
FILE_DERIVED_MANIFEST_KEYS = frozenset({"files", "size_bytes"})


def reference_release_dir(
    version: str,
    *,
    root: Path | None = None,
    reference: str = "auto",
) -> Path:
    """Reference tree: public vX if present, else staging vX (``auto``)."""
    public = public_release_dir(root=root) / f"v{version}"
    staging = staging_release_dir(root=root) / f"v{version}"
    if reference == "public":
        return public
    if reference == "staging":
        return staging
    if reference != "auto":
        raise ValueError(f"reference must be auto|public|staging, got {reference!r}")
    return public if public.is_dir() else staging


def _manifest_view(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    skip = VOLATILE_MANIFEST_KEYS | FILE_DERIVED_MANIFEST_KEYS
    return {k: v for k, v in payload.items() if k not in skip}


def diff_release_trees(reference: Path, candidate: Path) -> dict[str, Any]:
    """
    Byte-for-byte file diff plus a semantic manifest diff.

    ``manifest.json``, ``CHANGELOG.md`` and ``SHA256SUMS`` carry timestamps,
    promotion metadata or signature state and are excluded from the byte diff;
    the manifest is compared on every other field.
    """
    ref_files = {p.relative_to(reference).as_posix(): p for p in _data(reference)}
    cand_files = {p.relative_to(candidate).as_posix(): p for p in _data(candidate)}
    differing = sorted(
        name
        for name in set(ref_files) & set(cand_files)
        if sha256_file(ref_files[name]) != sha256_file(cand_files[name])
    )
    ref_manifest = _manifest_view(reference / "manifest.json")
    cand_manifest = _manifest_view(candidate / "manifest.json")
    manifest_diff = sorted(
        key
        for key in set(ref_manifest) | set(cand_manifest)
        if ref_manifest.get(key, "<absent>") != cand_manifest.get(key, "<absent>")
    )
    manifest_extra = sorted(set(cand_manifest) - set(ref_manifest))
    return {
        "missing_in_candidate": sorted(set(ref_files) - set(cand_files)),
        "extra_in_candidate": sorted(set(cand_files) - set(ref_files)),
        "differing": differing,
        "manifest_fields_differing": [
            k for k in manifest_diff if k not in manifest_extra
        ],
        "manifest_fields_extra_in_candidate": manifest_extra,
    }


def _data(base: Path) -> list[Path]:
    return [p for p in list_release_files(base) if p.name not in VOLATILE_FILES]


def reproduce_is_ok(diff: dict[str, Any], *, allow_extra: bool) -> bool:
    hard = (
        diff["missing_in_candidate"]
        or diff["differing"]
        or diff["manifest_fields_differing"]
    )
    extra = diff["extra_in_candidate"] or diff["manifest_fields_extra_in_candidate"]
    return not hard and (allow_extra or not extra)


def reproduce_release(
    version: str,
    *,
    root: Path | None = None,
    fixture_root: Path | None = None,
    reference: str = "auto",
    allow_extra: bool = False,
) -> dict[str, Any]:
    """
    Rebuild ``version`` and diff it against the reference release.

    With ``fixture_root`` the curated tables are rebuilt from recorded fixtures
    in a scratch root (CI path, no network). Without it the release is rebuilt
    from the ``curated/`` and ``status/freshness.json`` already under ``root``.
    The reference tree is never modified.
    """
    ref_dir = reference_release_dir(version, root=root, reference=reference)
    if not (ref_dir / "manifest.json").is_file():
        raise FileNotFoundError(f"reference release not found: {ref_dir}")
    with tempfile.TemporaryDirectory(prefix="atlas-reproduce-") as tmp:
        scratch = Path(tmp)
        build_root = root
        if fixture_root is not None:
            build_root = scratch / "root"
            build_root.mkdir()
            run_pipeline(
                steps=["check", "extract", "validate", "transform"],
                fixture_root=fixture_root,
                root=build_root,
                force=True,
            )
        candidate = scratch / f"v{version}"
        run_release(
            version, root=build_root, staging=True, force=True, out_dir=candidate
        )
        diff = diff_release_trees(ref_dir, candidate)
        # keep the scratch tree only for the duration of the diff
        shutil.rmtree(candidate, ignore_errors=True)
    ok = reproduce_is_ok(diff, allow_extra=allow_extra)
    return {
        "ok": ok,
        "version": version,
        "reference": str(ref_dir),
        "mode": "fixture" if fixture_root is not None else "curated",
        "allow_extra": allow_extra,
        **diff,
    }
