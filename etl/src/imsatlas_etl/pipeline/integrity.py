"""Release integrity: SHA256SUMS, signature status, verify-release."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

import pandas as pd

SHA256SUMS_NAME = "SHA256SUMS"
UNSIGNED_NOTE = "git tag -s not configured for this release"

# (args, cwd) -> (returncode, stdout)
GitRunner = Callable[[list[str], Path], tuple[int, str]]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def list_release_files(release_dir: Path) -> list[Path]:
    """Every regular file in the release except SHA256SUMS, sorted by POSIX path."""
    files = [
        path
        for path in release_dir.rglob("*")
        if path.is_file() and path.name != SHA256SUMS_NAME
    ]
    return sorted(files, key=lambda p: p.relative_to(release_dir).as_posix())


def render_sha256sums(release_dir: Path) -> str:
    """``sha256sum``-format text: ``<hash>  <relative path>`` per file."""
    lines = [
        f"{sha256_file(path)}  {path.relative_to(release_dir).as_posix()}"
        for path in list_release_files(release_dir)
    ]
    return "\n".join(lines) + ("\n" if lines else "")


def write_sha256sums(release_dir: Path) -> Path:
    target = release_dir / SHA256SUMS_NAME
    target.write_text(render_sha256sums(release_dir), encoding="utf-8")
    return target


def parse_sha256sums(text: str) -> dict[str, str]:
    """Parse sha256sum output into ``{relative path: hash}``; reject bad lines."""
    out: dict[str, str] = {}
    for number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        digest, sep, name = line.partition("  ")
        if sep != "  " or len(digest) != 64 or not name:
            raise ValueError(f"{SHA256SUMS_NAME} line {number}: malformed {line!r}")
        try:
            int(digest, 16)
        except ValueError as exc:
            raise ValueError(
                f"{SHA256SUMS_NAME} line {number}: non-hex digest",
            ) from exc
        if name in out:
            raise ValueError(f"{SHA256SUMS_NAME} line {number}: duplicate {name!r}")
        out[name] = digest
    return out


def _default_git(args: list[str], cwd: Path) -> tuple[int, str]:
    try:
        proc = subprocess.run(  # noqa: S603
            ["git", *args],  # noqa: S607
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return 127, ""
    return proc.returncode, proc.stdout.strip()


def signature_block(
    version: str,
    *,
    repo: Path,
    env: Mapping[str, str] | None = None,
    git: GitRunner = _default_git,
) -> dict[str, Any]:
    """
    Manifest ``signature`` field.

    Reports ``signed`` only when ``ATLAS_RELEASE_SIGNED=1`` and
    ``git verify-tag v<version>`` succeeds; nothing is ever fabricated.
    """
    environ = os.environ if env is None else env
    tag = f"v{version}"
    if environ.get("ATLAS_RELEASE_SIGNED") != "1":
        return {"status": "unsigned", "note": UNSIGNED_NOTE}
    code, _out = git(["verify-tag", tag], repo)
    if code != 0:
        return {
            "status": "unsigned",
            "note": (
                f"ATLAS_RELEASE_SIGNED=1 but no verifiable signed tag {tag} "
                "found (git verify-tag failed)"
            ),
        }
    code, tag_object = git(["rev-parse", tag], repo)
    block: dict[str, Any] = {"status": "signed", "tag": tag, "method": "git tag -s"}
    if code == 0 and tag_object:
        block["tag_object"] = tag_object
    return block


def _row_count(path: Path) -> int | None:
    if path.suffix != ".parquet":
        return None
    return int(len(pd.read_parquet(path)))


def verify_release(release_dir: Path) -> dict[str, Any]:
    """
    Recompute hashes against SHA256SUMS and manifest.json.

    Returns ``{"ok": bool, "problems": [str], "n_files": int}``. Problems cover
    missing/extra/changed files, malformed SHA256SUMS and manifest mismatches.
    """
    problems: list[str] = []
    if not release_dir.is_dir():
        return {
            "ok": False,
            "problems": [f"not a directory: {release_dir}"],
            "n_files": 0,
        }

    actual = {
        path.relative_to(release_dir).as_posix(): path
        for path in list_release_files(release_dir)
    }
    sums_path = release_dir / SHA256SUMS_NAME
    if not sums_path.is_file():
        problems.append(f"{SHA256SUMS_NAME} missing")
    else:
        try:
            recorded = parse_sha256sums(sums_path.read_text(encoding="utf-8"))
        except ValueError as exc:
            problems.append(str(exc))
            recorded = {}
        for name, digest in sorted(recorded.items()):
            path = actual.get(name)
            if path is None:
                problems.append(f"{SHA256SUMS_NAME}: listed file missing: {name}")
            elif sha256_file(path) != digest:
                problems.append(f"{SHA256SUMS_NAME}: hash mismatch: {name}")
        for name in sorted(set(actual) - set(recorded)):
            problems.append(f"{SHA256SUMS_NAME}: file not listed: {name}")

    manifest_path = release_dir / "manifest.json"
    if not manifest_path.is_file():
        problems.append("manifest.json missing")
    else:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for entry in manifest.get("files") or []:
            name = str(entry.get("path"))
            path = actual.get(name)
            if path is None:
                problems.append(f"manifest: listed file missing: {name}")
                continue
            if sha256_file(path) != entry.get("sha256"):
                problems.append(f"manifest: sha256 mismatch: {name}")
            if path.stat().st_size != entry.get("bytes"):
                problems.append(f"manifest: byte size mismatch: {name}")
            rows = entry.get("rows")
            if rows is not None and _row_count(path) != rows:
                problems.append(f"manifest: row count mismatch: {name}")
    return {"ok": not problems, "problems": problems, "n_files": len(actual)}
