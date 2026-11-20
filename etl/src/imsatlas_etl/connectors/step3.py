"""Shared helpers for the Step 3 file-download connectors.

Each connector downloads one or more publisher files, keeps the verbatim bytes
(+ ``.meta.json`` with sha256) next to a normalised table, and records every
discarded row in ``summary.json``. A human-placed file under
``data/manual/<source>/`` (canonical layout, see that folder's README) always
wins over the network, so a blocked or changed upstream never stops a run.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors import manual_drop
from imsatlas_etl.connectors.http import (
    SourceUnavailableError,
    fetch_bytes,
    head_headers,
    write_artifact,
)
from imsatlas_etl.connectors.manual import find_drop
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir

Fetcher = Callable[[str], tuple[bytes, dict[str, str]]]
Header = Callable[[str], dict[str, str]]

VALUES_COLUMNS = ["iso3", "year", "value"]


def default_fetch(url: str) -> tuple[bytes, dict[str, str]]:
    return fetch_bytes(url, timeout=120.0)


def default_head(url: str) -> dict[str, str]:
    return head_headers(url)


@dataclass(frozen=True)
class Artifact:
    """A verbatim publisher file kept in the raw version directory."""

    name: str
    body: bytes
    url: str
    headers: dict[str, str] = field(default_factory=dict)


def has_manual_drop(source_id: str, *, root: Path | None) -> bool:
    """True when the canonical manual file for ``source_id`` is in place."""
    try:
        find_drop(
            source_id,
            root=root,
            name=manual_drop.MANUAL_FILES[source_id],
        )
    except SourceUnavailableError:
        return False
    return True


def clean_iso3(value: Any) -> str | None:
    """Upper-case 3-letter code, or None (never guesses a code)."""
    if not isinstance(value, str):
        return None
    code = value.strip().upper()
    return code if len(code) == 3 and code.isalpha() else None


def tidy_values(
    records: list[dict[str, Any]],
    counts: dict[str, int],
    *,
    label: str,
) -> pd.DataFrame:
    """Build the (iso3, year, value) frame; refuse duplicates and empty output."""
    frame = pd.DataFrame.from_records(records, columns=VALUES_COLUMNS)
    if frame.empty:
        raise ValueError(f"{label}: no usable rows (publisher layout changed?)")
    dup = frame.duplicated(["iso3", "year"], keep=False)
    if dup.any():
        sample = frame[dup].head(5).to_dict("records")
        raise ValueError(f"{label}: duplicate (iso3, year) rows, e.g. {sample}")
    counts["n_kept"] = len(frame)
    return frame.sort_values(["iso3", "year"]).reset_index(drop=True)


def write_raw(
    source_id: str,
    version: str,
    *,
    root: Path | None,
    table_name: str,
    table: pd.DataFrame,
    artifacts: list[Artifact],
    summary: dict[str, Any],
    upstream_changed_at: str | None,
    tidy_url: str,
) -> dict[str, Any]:
    """Write artefacts, the normalised table and ``summary.json``; return result."""
    dest_dir = raw_source_dir(source_id, version, root=root)
    for art in artifacts:
        write_artifact(
            dest_dir / art.name,
            art.body,
            url=art.url,
            headers=art.headers,
            extra_meta={"mode": "live", "version": version, "role": "verbatim"},
        )
    years = sorted(int(y) for y in table["year"].unique())
    stats = {
        "source": source_id,
        "version": version,
        "mode": "live",
        "rows": int(len(table)),
        "countries": int(table["iso3"].nunique()),
        "year_min": years[0],
        "year_max": years[-1],
        "years": years,
        "upstream_changed_at": upstream_changed_at,
        "min_year_filter": MIN_YEAR,
        **summary,
    }
    (dest_dir / "summary.json").write_text(
        json.dumps(stats, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    path = dest_dir / table_name
    meta = write_artifact(
        path,
        table.to_csv(index=False).encode("utf-8"),
        url=tidy_url,
        headers={},
        extra_meta={
            "mode": "live",
            "version": version,
            "role": "normalised",
            "derived_from": [a.name for a in artifacts],
            "source_sha256": {a.name: _sha(a.body) for a in artifacts},
        },
    )
    return {
        "source": source_id,
        "version": version,
        "path": str(path),
        "skipped": False,
        "meta": meta,
        "rows": stats["rows"],
        "countries": stats["countries"],
        "years": [years[0], years[-1]],
        "upstream_version": version,
    }


def _sha(body: bytes) -> str:
    import hashlib

    return hashlib.sha256(body).hexdigest()


def skipped(source_id: str, version: str, path: Path) -> dict[str, Any]:
    return {
        "source": source_id,
        "version": version,
        "path": str(path),
        "skipped": True,
    }
