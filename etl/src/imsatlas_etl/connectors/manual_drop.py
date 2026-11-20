"""Manual-drop sources: copy + hash a human-placed CSV into data/raw.

Covers Hofstede and the Phase 3 index sources. The file must already be in
the canonical raw layout (see each ``data/manual/<source>/README.md``); this
module never edits values and never fetches anything.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from imsatlas_etl.connectors.http import write_artifact
from imsatlas_etl.connectors.manual import (
    find_drop,
    load_pin,
    manual_version,
    verify_pin,
)
from imsatlas_etl.pipeline.io_paths import (
    INDICATOR_FILE_SOURCES,
    PHASE3_INDEX_SOURCES,
    raw_source_dir,
)

# source id -> canonical file name expected in data/manual/<source>/
MANUAL_FILES: dict[str, str] = {
    "hofstede": "dimensions.csv",
    **{source_id: "values.csv" for source_id in PHASE3_INDEX_SOURCES},
    **{source_id: "indicators.csv" for source_id in INDICATOR_FILE_SOURCES},
    # EXTRA-4/6/7/9 documented drops (README-only until a file is placed)
    "auma_fairs": "fairs.csv",
    "icex_events": "events.csv",
    "trade_gov_events": "events.csv",
    "dane_dian_comex": "trade.csv",
    "wto_tariffs": "tariffs.csv",
    "wto_itip": "ntm.csv",
    "fragile_states_index": "values.csv",
    "kof_globalisation": "values.csv",
    "global_trade_alert": "values.csv",
}


def is_manual_source(source_id: str) -> bool:
    return source_id in MANUAL_FILES


def _drop_path(source_id: str, *, root: Path | None) -> Path:
    return find_drop(source_id, root=root, name=MANUAL_FILES[source_id])


def live_version(source_id: str, *, root: Path | None = None) -> str:
    """Pin version if present, else ``manual-<sha12>`` of the dropped file."""
    return manual_version(source_id, _drop_path(source_id, root=root), root=root)


def extract_live(
    source_id: str,
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    name = MANUAL_FILES[source_id]
    dest = raw_source_dir(source_id, version, root=root) / name
    if dest.is_file() and not force:
        return {
            "source": source_id,
            "version": version,
            "path": str(dest),
            "skipped": True,
        }
    src = _drop_path(source_id, root=root)
    pin = load_pin(source_id, root=root)
    observed = verify_pin(src, pin) if pin else None
    meta = write_artifact(
        dest,
        src.read_bytes(),
        url=f"manual://{source_id}/{name}",
        headers={},
        extra_meta={
            "mode": "live",
            "input": "manual_drop",
            "version": version,
            "pin_checked": bool(observed and observed["pin_checked"]),
            "pin_url": pin.url if pin else None,
        },
    )
    return {
        "source": source_id,
        "version": version,
        "path": str(dest),
        "skipped": False,
        "meta": meta,
    }
