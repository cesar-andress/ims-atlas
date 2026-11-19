"""Terms-of-use drift: has a source's terms page changed since the rights check?

Baseline: ``rights.evidence.snapshot_sha256`` (set by the human-only
``rights-verify``). Current: a locally stored snapshot digest under
``status/terms/<source>.json`` or ``data/manual/terms/<source>.json``. The
comparison is pure; only ``write_terms_snapshot`` touches the network and it
takes an injectable fetcher.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable, Iterable, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.io_paths import data_root, status_root
from imsatlas_etl.rights import fetch_terms_bytes
from imsatlas_etl.sources import SourcesValidationError, sources_by_id

_SHA256 = re.compile(r"^[0-9a-f]{64}$")

TermsFetcher = Callable[[str], bytes]


def terms_snapshot_paths(source_id: str, *, root: Path | None = None) -> list[Path]:
    """Candidate current-snapshot files, in priority order."""
    return [
        status_root(root) / "terms" / f"{source_id}.json",
        data_root(root) / "manual" / "terms" / f"{source_id}.json",
    ]


def normalize_sha256(value: object) -> str | None:
    """Lower-case 64-hex digest, or ``None`` for anything else (incl. empty)."""
    if not isinstance(value, str):
        return None
    digest = value.strip().lower()
    return digest if _SHA256.match(digest) else None


def load_current_terms_sha(source_id: str, *, root: Path | None = None) -> str | None:
    for path in terms_snapshot_paths(source_id, root=root):
        if not path.is_file():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            digest = normalize_sha256(payload.get("sha256"))
            if digest:
                return digest
    return None


def compare_terms_hash(evidence_sha: object, current_sha: object) -> bool | None:
    """``True`` if both digests are present and differ, ``False`` if equal.

    ``None`` when either side is missing or malformed: drift is unknown.
    """
    baseline = normalize_sha256(evidence_sha)
    current = normalize_sha256(current_sha)
    if baseline is None or current is None:
        return None
    return baseline != current


def _registry_or_empty() -> Mapping[str, Mapping[str, Any]]:
    """Source registry; empty (drift unknown) when no registry exists under root."""
    try:
        return sources_by_id()
    except FileNotFoundError:
        return {}


def terms_changed_for_source(
    source: Mapping[str, Any],
    *,
    root: Path | None = None,
) -> bool | None:
    evidence = (source.get("rights") or {}).get("evidence") or {}
    current = load_current_terms_sha(str(source.get("id")), root=root)
    return compare_terms_hash(evidence.get("snapshot_sha256"), current)


def annotate_terms_changed(
    rows: Iterable[dict[str, Any]],
    *,
    registry: Mapping[str, Mapping[str, Any]] | None = None,
    root: Path | None = None,
) -> list[dict[str, Any]]:
    """Copies of freshness rows with ``terms_changed`` (bool or null) set."""
    sources = registry if registry is not None else _registry_or_empty()
    out: list[dict[str, Any]] = []
    for row in rows:
        source = sources.get(str(row.get("source")))
        changed = terms_changed_for_source(source, root=root) if source else None
        out.append({**row, "terms_changed": changed})
    return out


def write_terms_snapshot(
    source_id: str,
    *,
    root: Path | None = None,
    fetch: TermsFetcher = fetch_terms_bytes,
    registry: Mapping[str, Mapping[str, Any]] | None = None,
    now: datetime | None = None,
) -> Path:
    """Fetch the terms page and store its digest (never edits the evidence)."""
    sources = registry if registry is not None else sources_by_id()
    source = sources.get(source_id)
    if source is None:
        raise SourcesValidationError(f"unknown source id: {source_id}")
    evidence = (source.get("rights") or {}).get("evidence") or {}
    url = evidence.get("terms_url") or source.get("terms_url")
    if not isinstance(url, str) or not url.strip():
        raise SourcesValidationError(f"{source_id}: missing terms_url")
    body = fetch(url)
    stamp = (now or datetime.now(UTC)).replace(microsecond=0)
    payload = {
        "source": source_id,
        "terms_url": url,
        "sha256": hashlib.sha256(body).hexdigest(),
        "bytes": len(body),
        "checked_at": stamp.isoformat().replace("+00:00", "Z"),
    }
    path = terms_snapshot_paths(source_id, root=root)[0]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", "utf-8")
    return path
