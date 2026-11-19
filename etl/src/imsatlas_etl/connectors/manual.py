"""Manual-drop inputs: data/manual/<source>/ files, optional pins, safe unzip.

Nothing here downloads or invents URLs. A human places the file under
``data/manual/<source>/`` (gitignored); an optional pin file
``config/pins/<source>.json`` fixes version, size and SHA-256.
"""

from __future__ import annotations

import json
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from imsatlas_etl.connectors.http import SourceUnavailableError, sha256_file
from imsatlas_etl.paths import repo_root

PIN_FIELDS = ("version", "sha256", "bytes", "url")


class PinMismatchError(ValueError):
    """The dropped file does not match its pin (size or sha256)."""


@dataclass(frozen=True)
class Pin:
    version: str | None
    sha256: str | None
    bytes: int | None
    url: str | None
    filename: str | None = None
    options: dict[str, Any] | None = None


def manual_dir(source_id: str, *, root: Path | None = None) -> Path:
    return (root or repo_root()) / "data" / "manual" / source_id


def pin_path(source_id: str, *, root: Path | None = None) -> Path:
    return (root or repo_root()) / "config" / "pins" / f"{source_id}.json"


def load_pin(source_id: str, *, root: Path | None = None) -> Pin | None:
    """Return the pin for a source, or None when no pin file exists."""
    path = pin_path(source_id, root=root)
    if not path.is_file():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"{path}: expected a JSON object")
    unknown = set(raw) - set(PIN_FIELDS) - {"filename", "options", "comment"}
    if unknown:
        raise ValueError(f"{path}: unknown pin fields {sorted(unknown)}")
    size = raw.get("bytes")
    return Pin(
        version=_opt_str(raw.get("version")),
        sha256=_opt_str(raw.get("sha256")),
        bytes=int(size) if size is not None else None,
        url=_opt_str(raw.get("url")),
        filename=_opt_str(raw.get("filename")),
        options=dict(raw["options"]) if raw.get("options") else None,
    )


def _opt_str(value: Any) -> str | None:
    return None if value is None else str(value)


def verify_pin(path: Path, pin: Pin) -> dict[str, Any]:
    """Check size and sha256 against the pin; return the observed values."""
    size = path.stat().st_size
    digest = sha256_file(path)
    if pin.bytes is not None and size != pin.bytes:
        raise PinMismatchError(
            f"{path.name}: size {size} != pinned {pin.bytes}",
        )
    if pin.sha256 is not None and digest.lower() != pin.sha256.lower():
        raise PinMismatchError(
            f"{path.name}: sha256 {digest} != pinned {pin.sha256}",
        )
    return {
        "sha256": digest,
        "bytes": size,
        "pin_checked": pin.bytes is not None or pin.sha256 is not None,
    }


def find_drop(
    source_id: str,
    *,
    root: Path | None = None,
    suffix: str | None = None,
    name: str | None = None,
) -> Path:
    """Locate the single dropped file (by exact name, pin filename, or suffix)."""
    directory = manual_dir(source_id, root=root)
    hint = f"see data/manual/{source_id}/README.md"
    if not directory.is_dir():
        raise SourceUnavailableError(
            f"{source_id}: missing manual drop directory ({hint})",
        )
    pin = load_pin(source_id, root=root)
    wanted = name or (pin.filename if pin else None)
    if wanted:
        path = directory / wanted
        if not path.is_file():
            raise SourceUnavailableError(f"{source_id}: missing {wanted} ({hint})")
        return path
    candidates = sorted(
        p
        for p in directory.iterdir()
        if p.is_file() and (suffix is None or p.suffix.lower() == suffix)
    )
    if not candidates:
        raise SourceUnavailableError(
            f"{source_id}: no {suffix or 'data'} file in manual drop ({hint})",
        )
    if len(candidates) > 1:
        raise SourceUnavailableError(
            f"{source_id}: several candidate files {[p.name for p in candidates]}; "
            f"set 'filename' in config/pins/{source_id}.json",
        )
    return candidates[0]


def manual_version(source_id: str, path: Path, *, root: Path | None = None) -> str:
    """Pinned version if present, else a content-derived ``manual-<sha12>``."""
    pin = load_pin(source_id, root=root)
    if pin is not None and pin.version:
        return pin.version
    return f"manual-{sha256_file(path)[:12]}"


def safe_extract(archive: Path, dest: Path) -> list[dict[str, Any]]:
    """Extract a zip, rejecting path traversal; return member name/size list."""
    dest.mkdir(parents=True, exist_ok=True)
    base = dest.resolve()
    members: list[dict[str, Any]] = []
    with zipfile.ZipFile(archive) as zf:
        for info in zf.infolist():
            target = (dest / info.filename).resolve()
            if base != target and base not in target.parents:
                raise ValueError(f"unsafe zip member: {info.filename!r}")
            if info.is_dir():
                continue
            zf.extract(info, dest)
            members.append({"name": info.filename, "bytes": info.file_size})
    return sorted(members, key=lambda m: str(m["name"]))
