"""Filesystem layout for raw/curated/status artefacts."""

from __future__ import annotations

import json
from pathlib import Path

from imsatlas_etl.paths import repo_root

PIPELINE_SOURCES = (
    "worldbank_wdi",
    "worldbank_wgi",
    "worldbank_lpi",
    "baci",
    "cepi_gravity",
    "wits_trains",
    "hofstede",
    # Phase 3 index sources (fixture-first; mostly BYOD until rights verified)
    "itu_datahub",
    "ef_epi",
    "odin",
    "gedi",
    "wipo_gii",
    "startupblink",
    "yale_epi",
    # Step 3: attested open sources used by the catalog (live file download
    # or documented manual drop; see docs/step3-manual-drops.md)
    "inform_risk",
    "transparency_cpi",
    "worldbank_doing_business",
    "unctadstat",
    "imf_weo",
)

# Live-only connectors (no mini_world fixture yet). Hourly + freshness only.
HOURLY_LIVE_SOURCES = (
    "ecb_fx",
    "vat_rates",
    "kof_globalisation",
    "fragile_states_index",
)

# EXTRA-4: also report these in freshness.json as ok / falta fichero / no conectada.
# Not part of the core extract set until a connector + fixture exists.
EXTRA_FRESHNESS_SOURCES = (
    "auma_fairs",
    "icex_events",
    "trade_gov_events",
    "dane_dian_comex",
    "wto_tariffs",
    "wto_itip",
    "global_trade_alert",
    *HOURLY_LIVE_SOURCES,
)

PHASE3_INDEX_SOURCES = (
    "itu_datahub",
    "ef_epi",
    "odin",
    "gedi",
    "wipo_gii",
    "startupblink",
    "yale_epi",
    "inform_risk",
    "transparency_cpi",
)

# Long (iso3, year, indicator, value) raw tables stored as ``indicators.csv``
# but not pulled from the World Bank v2 API.
INDICATOR_FILE_SOURCES = (
    "worldbank_doing_business",
    "unctadstat",
    "imf_weo",
)

# Step 3 sources whose raw layout is verified (see each connector docstring).
STEP3_SOURCES = (
    "inform_risk",
    "transparency_cpi",
    "wipo_gii",
    "worldbank_doing_business",
    "unctadstat",
    "imf_weo",
)


def data_root(root: Path | None = None) -> Path:
    return (root or repo_root()) / "data"


def status_root(root: Path | None = None) -> Path:
    return (root or repo_root()) / "status"


def raw_source_dir(source_id: str, version: str, *, root: Path | None = None) -> Path:
    return data_root(root) / "raw" / source_id / version


def curated_dir(*, root: Path | None = None) -> Path:
    return data_root(root) / "curated"


def freshness_path(*, root: Path | None = None) -> Path:
    return status_root(root) / "freshness.json"


def runs_dir(*, root: Path | None = None) -> Path:
    return status_root(root) / "runs"


def release_dir(*, root: Path | None = None) -> Path:
    return data_root(root) / "release"


def staging_release_dir(*, root: Path | None = None) -> Path:
    return release_dir(root=root) / "staging"


def public_release_dir(*, root: Path | None = None) -> Path:
    return release_dir(root=root) / "public"


def internal_release_dir(*, root: Path | None = None) -> Path:
    """CERRADO / team-only releases (never under app/public)."""
    return release_dir(root=root) / "internal"


def staging_internal_release_dir(*, root: Path | None = None) -> Path:
    return release_dir(root=root) / "staging" / "internal"


def qa_json_path(*, root: Path | None = None) -> Path:
    return status_root(root) / "qa.json"


def lineage_path(*, root: Path | None = None) -> Path:
    return status_root(root) / "lineage.json"


# Canonical raw table per source; a version dir counts as ingested only once
# one of these exists (partial live pulls leave pages/ or xml/ behind).
TABLE_FILES = (
    "indicators.csv",
    "trade.csv",
    "bilateral.csv",
    "tariffs.csv",
    "dimensions.csv",
    "values.csv",
)


def _table_mode(version_dir: Path) -> tuple[Path, str | None] | None:
    for name in TABLE_FILES:
        table = version_dir / name
        if table.is_file():
            meta = table.with_suffix(table.suffix + ".meta.json")
            mode = None
            if meta.is_file():
                mode = json.loads(meta.read_text(encoding="utf-8")).get("mode")
            return table, mode
    return None


def ingested_versions(
    source_id: str,
    *,
    mode: str | None = None,
    root: Path | None = None,
) -> list[str]:
    """Ingested raw versions, oldest to newest (by table mtime).

    With ``mode`` set, versions written by the other mode are ignored so that
    fixture and live raw data never masquerade as each other.
    """
    base = data_root(root) / "raw" / source_id
    if not base.is_dir():
        return []
    found: list[tuple[int, str]] = []
    for path in base.iterdir():
        info = _table_mode(path) if path.is_dir() else None
        if info is None:
            continue
        table, table_mode = info
        if mode is not None and table_mode not in (None, mode):
            continue
        found.append((table.stat().st_mtime_ns, path.name))
    return [name for _mtime, name in sorted(found)]
