"""Step 2: download/copy into data/raw/<source>/<version>/."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from imsatlas_etl.connectors import (
    baci,
    country_index,
    cpi,
    doing_business,
    ecb_fx,
    fragile_states,
    gravity,
    hofstede,
    imf_weo,
    inform,
    kof_globalisation,
    manual_drop,
    vat_rates,
    wipo_gii,
    wits,
)
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.pipeline.io_paths import (
    HOURLY_LIVE_SOURCES,
    INDICATOR_FILE_SOURCES,
    PHASE3_INDEX_SOURCES,
    PIPELINE_SOURCES,
    freshness_path,
)

_EXTRACTABLE = frozenset([*PIPELINE_SOURCES, *HOURLY_LIVE_SOURCES])


def _versions_from_freshness(
    *,
    root: Path | None,
    sources: list[str],
) -> dict[str, str]:
    path = freshness_path(root=root)
    if not path.is_file():
        raise FileNotFoundError(
            f"missing {path}; run atlas-etl check first",
        )
    payload = json.loads(path.read_text(encoding="utf-8"))
    by_id = {row["source"]: row for row in payload.get("sources", [])}
    out: dict[str, str] = {}
    for source_id in sources:
        row = by_id.get(source_id)
        if not row:
            raise KeyError(f"source {source_id} not in freshness.json")
        upstream = row.get("upstream_version")
        if upstream is None or upstream == "":
            continue
        out[source_id] = str(upstream)
    return out


WB_SOURCES = frozenset({"worldbank_wdi", "worldbank_wgi", "worldbank_lpi"})


def _extract_live(
    source_id: str,
    version: str,
    *,
    root: Path | None,
    force: bool,
) -> dict[str, Any]:
    if source_id in WB_SOURCES:
        return wb.extract_live(source_id, version, root=root, force=force)
    if source_id == "baci":
        return baci.extract_live(version, root=root, force=force)
    if source_id == "cepi_gravity":
        return gravity.extract_live(version, root=root, force=force)
    if source_id == "wits_trains":
        return wits.extract_live(version, root=root, force=force)
    if source_id == "hofstede":
        return hofstede.extract_live(version, root=root, force=force)
    if source_id == "ecb_fx":
        return ecb_fx.extract_live(version, root=root, force=force)
    if source_id == "vat_rates":
        return vat_rates.extract_live(version, root=root, force=force)
    if source_id == "imf_weo":
        return imf_weo.extract_live(version, root=root, force=force)
    if source_id == "kof_globalisation":
        return kof_globalisation.extract_live(version, root=root, force=force)
    if source_id == "fragile_states_index":
        return fragile_states.extract_live(version, root=root, force=force)
    # Step 3: live file download unless a manual drop is in place; sources with
    # no verified auto-fetch (unctadstat, yale_epi, …) fall through to manual_drop.
    step3 = {
        "inform_risk": inform.extract_live,
        "transparency_cpi": cpi.extract_live,
        "wipo_gii": wipo_gii.extract_live,
        "worldbank_doing_business": doing_business.extract_live,
    }
    if source_id in step3:
        return step3[source_id](version, root=root, force=force)
    if manual_drop.is_manual_source(source_id):
        return manual_drop.extract_live(source_id, version, root=root, force=force)
    raise ValueError(f"unsupported extract source: {source_id}")


def _extract_fixture(
    source_id: str,
    version: str,
    *,
    fixture_root: Path,
    root: Path | None,
    force: bool,
) -> dict[str, Any]:
    if source_id in WB_SOURCES or source_id in INDICATOR_FILE_SOURCES:
        return wb.extract_from_fixture(
            source_id,
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    simple = {
        "baci": baci.extract_from_fixture,
        "cepi_gravity": gravity.extract_from_fixture,
        "hofstede": hofstede.extract_from_fixture,
        "wits_trains": wits.extract_from_fixture,
    }
    if source_id in simple:
        return simple[source_id](
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    if source_id in PHASE3_INDEX_SOURCES:
        return country_index.extract_from_fixture(
            source_id,
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    raise ValueError(f"unsupported extract source: {source_id}")


def extract_source(
    source_id: str,
    version: str,
    *,
    fixture_root: Path | None,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Fixture mode when ``fixture_root`` is set, otherwise live/manual extract."""
    if fixture_root is not None:
        return _extract_fixture(
            source_id,
            version,
            fixture_root=fixture_root,
            root=root,
            force=force,
        )
    return _extract_live(source_id, version, root=root, force=force)


def run_extract(
    *,
    sources: list[str] | None = None,
    fixture_root: Path | None = None,
    root: Path | None = None,
    force: bool = False,
) -> list[dict[str, Any]]:
    from imsatlas_etl.connectors.http import SourceUnavailableError

    selected = list(sources) if sources else list(PIPELINE_SOURCES)
    for source_id in selected:
        if source_id not in _EXTRACTABLE:
            raise ValueError(f"unknown extract source: {source_id}")
    # Live partial runs: only extract sources present in freshness.
    path = freshness_path(root=root)
    if not path.is_file():
        raise FileNotFoundError(f"missing {path}; run atlas-etl check first")
    payload = json.loads(path.read_text(encoding="utf-8"))
    fresh_ids = {row["source"] for row in payload.get("sources", [])}
    versions = _versions_from_freshness(
        root=root,
        sources=[s for s in selected if s in fresh_ids],
    )
    results: list[dict[str, Any]] = []
    for source_id in selected:
        if source_id not in versions:
            results.append(
                {
                    "source": source_id,
                    "version": None,
                    "skipped": True,
                    "missing": True,
                    "reason": "not in freshness.json",
                },
            )
            continue
        try:
            results.append(
                extract_source(
                    source_id,
                    versions[source_id],
                    fixture_root=fixture_root,
                    root=root,
                    force=force,
                ),
            )
        except (SourceUnavailableError, FileNotFoundError, ValueError, KeyError) as exc:
            # Manual drops / archived indicators: record and continue.
            results.append(
                {
                    "source": source_id,
                    "version": versions[source_id],
                    "skipped": True,
                    "missing": True,
                    "reason": str(exc),
                },
            )

    # Refresh ingested_version / stale after a successful extract.
    by_result = {
        r["source"]: r["version"]
        for r in results
        if r.get("version") and not r.get("missing")
    }
    for row in payload.get("sources", []):
        sid = row.get("source")
        if sid in by_result:
            row["ingested_version"] = by_result[sid]
            row["stale"] = row.get("upstream_version") != by_result[sid]
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return results
