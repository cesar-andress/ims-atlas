"""Per-source coverage for the Step 3 sources (rows / countries / years).

Some Step 3 sources have no catalog variable yet (Doing Business, UNCTADstat,
IMF WEO), so ``variables_country_year`` cannot show them. This summary reads
each raw table directly; a source with no raw table (manual file absent, not
in ``freshness.json``) is reported with its reason instead of being dropped
silently.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from imsatlas_etl.connectors import country_index
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.pipeline.io_paths import STEP3_SOURCES, TABLE_FILES, raw_source_dir

DOCS_HINT = "see docs/step3-manual-drops.md and data/manual/{source}/README.md"


def _table_path(source_id: str, version: str, *, root: Path | None) -> Path | None:
    base = raw_source_dir(source_id, version, root=root)
    for name in TABLE_FILES:
        candidate = base / name
        if candidate.is_file():
            return candidate
    return None


def _load(path: Path) -> tuple[Any, list[str] | None]:
    if path.name == "values.csv":
        frame, unmatched = country_index.load_raw_values(path)
        if unmatched:
            raise ValueError(f"{len(unmatched)} unmatched country names")
        return frame, None
    frame = wb.load_raw_indicators(path)
    return frame, sorted(str(i) for i in frame["indicator"].unique())


def summarize_step3_sources(
    versions: dict[str, str],
    *,
    root: Path | None,
    missing: list[dict[str, str]],
) -> dict[str, dict[str, Any]]:
    """Return ``{source_id: {status, rows, countries, years, ...}}``.

    Appends ``{"id", "reason"}`` to ``missing`` for every source without a
    usable raw table (de-duplicated against reasons already recorded).
    """
    out: dict[str, dict[str, Any]] = {}
    for source_id in STEP3_SOURCES:
        reason: str | None = None
        info: dict[str, Any] = {"status": "missing"}
        version = versions.get(source_id)
        if version is None:
            reason = f"not in freshness.json; {DOCS_HINT.format(source=source_id)}"
        else:
            info["version"] = version
            path = _table_path(source_id, version, root=root)
            if path is None:
                reason = (
                    f"no raw table for version {version}; "
                    f"{DOCS_HINT.format(source=source_id)}"
                )
            else:
                try:
                    frame, indicators = _load(path)
                except (ValueError, OSError) as exc:
                    reason = f"raw table unreadable: {exc}"
                else:
                    info = {
                        "status": "ok",
                        "version": version,
                        "table": path.name,
                        "rows": int(len(frame)),
                        "countries": int(frame["iso3"].nunique()),
                        "years": sorted(int(y) for y in frame["year"].unique()),
                    }
                    if indicators is not None:
                        info["indicators"] = indicators
        if reason is not None:
            info["reason"] = reason
            if not any(row["id"] == source_id for row in missing):
                missing.append({"id": source_id, "reason": reason})
        out[source_id] = info
    return out
