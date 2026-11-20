"""Step 1: cheap upstream version check -> status/freshness.json."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.connectors.http import SourceUnavailableError
from imsatlas_etl.pipeline.io_paths import (
    EXTRA_FRESHNESS_SOURCES,
    PIPELINE_SOURCES,
    freshness_path,
    ingested_versions,
)
from imsatlas_etl.pipeline.terms import annotate_terms_changed

KNOWN_CHECK_SOURCES = tuple(
    dict.fromkeys([*PIPELINE_SOURCES, *EXTRA_FRESHNESS_SOURCES]),
)


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _ingested_version(
    source_id: str,
    *,
    root: Path | None,
    mode: str | None = None,
) -> str | None:
    versions = ingested_versions(source_id, mode=mode, root=root)
    return versions[-1] if versions else None


def _baci_latest_year(root: Path | None) -> int | None:
    """Read year_max from config/pins/baci.json when present."""
    from imsatlas_etl.paths import repo_root

    pin = (root or repo_root()) / "config" / "pins" / "baci.json"
    if not pin.is_file():
        return None
    try:
        data = json.loads(pin.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    opts = data.get("options") if isinstance(data, dict) else None
    if isinstance(opts, dict) and opts.get("year_max") is not None:
        try:
            return int(opts["year_max"])
        except (TypeError, ValueError):
            return None
    if isinstance(data, dict) and data.get("year_max") is not None:
        try:
            return int(data["year_max"])
        except (TypeError, ValueError):
            return None
    return None


def check_source_offline(
    source_id: str,
    *,
    fixture_root: Path,
    root: Path | None = None,
) -> dict[str, Any]:
    """Read version metadata from recorded fixtures (no network)."""
    meta_path = fixture_root / source_id / "version.json"
    if not meta_path.is_file():
        raise FileNotFoundError(
            f"missing fixture version.json for {source_id}: {meta_path}",
        )
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    upstream_version = str(meta["upstream_version"])
    upstream_changed_at = meta.get("upstream_changed_at")
    ingested = _ingested_version(source_id, root=root, mode="fixture")
    stale = ingested != upstream_version
    return {
        "source": source_id,
        "checked_at": _now_iso(),
        "upstream_version": upstream_version,
        "upstream_changed_at": upstream_changed_at,
        "ingested_version": ingested,
        "stale": stale,
        "mode": "fixture",
        "status": "ok",
    }


def _live_probe(source_id: str, *, root: Path | None) -> dict[str, Any]:
    from imsatlas_etl.connectors import (
        baci,
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
        yale_epi,
    )
    from imsatlas_etl.connectors import worldbank as wb
    from imsatlas_etl.connectors.step3 import has_manual_drop

    if source_id in {"worldbank_wdi", "worldbank_wgi", "worldbank_lpi"}:
        return wb.probe_version(source_id)
    note = "manual drop; version from pin or content hash"
    if source_id == "baci":
        return {"upstream_version": baci.live_version(root=root), "note": note}
    if source_id == "cepi_gravity":
        return {"upstream_version": gravity.live_version(root=root), "note": note}
    if source_id == "wits_trains":
        return {
            "upstream_version": wits.live_version(root=root),
            "note": "version label from config/wits_trains.json; local_only",
        }
    if source_id == "hofstede":
        return hofstede.probe_version()
    if source_id == "ecb_fx":
        return ecb_fx.probe_version()
    if source_id == "vat_rates":
        return vat_rates.probe_version(root=root)
    if source_id == "imf_weo":
        if has_manual_drop(source_id, root=root):
            return {
                "upstream_version": manual_drop.live_version(source_id, root=root),
                "note": note,
            }
        return imf_weo.probe_version()
    if source_id == "kof_globalisation":
        if has_manual_drop(source_id, root=root):
            return {
                "upstream_version": manual_drop.live_version(source_id, root=root),
                "note": note,
            }
        return kof_globalisation.probe_version()
    if source_id == "fragile_states_index":
        if has_manual_drop(source_id, root=root):
            return {
                "upstream_version": manual_drop.live_version(source_id, root=root),
                "note": note,
            }
        return fragile_states.probe_version()
    if source_id == "yale_epi":
        if has_manual_drop(source_id, root=root):
            return {
                "upstream_version": manual_drop.live_version(source_id, root=root),
                "note": note,
            }
        return yale_epi.probe_version()
    step3 = {
        "inform_risk": inform,
        "transparency_cpi": cpi,
        "wipo_gii": wipo_gii,
        "worldbank_doing_business": doing_business,
    }
    if source_id in step3:
        # A manual drop wins; otherwise a cheap HEAD/API probe (no download).
        if has_manual_drop(source_id, root=root):
            return {
                "upstream_version": manual_drop.live_version(source_id, root=root),
                "note": note,
            }
        return step3[source_id].probe_version()
    if manual_drop.is_manual_source(source_id):
        return {
            "upstream_version": manual_drop.live_version(source_id, root=root),
            "note": note,
        }
    raise ValueError(f"unsupported live check source: {source_id}")


def _missing_manual_row(
    source_id: str,
    *,
    root: Path | None,
    err: str,
) -> dict[str, Any]:
    """EXTRA-4: missing manual drop is a reported status, not a hard failure."""
    return {
        "source": source_id,
        "checked_at": _now_iso(),
        "upstream_version": None,
        "upstream_changed_at": None,
        "ingested_version": _ingested_version(source_id, root=root, mode="live"),
        "stale": True,
        "mode": "live",
        "status": "falta fichero (manual)",
        "note": err,
    }


def check_source_live(source_id: str, *, root: Path | None = None) -> dict[str, Any]:
    """Live version probe.

    World Bank sources use the API ``lastupdated``; manual-drop sources use the
    pinned version or a content hash. Missing manual files return a soft
    ``falta fichero (manual)`` row (EXTRA-4) instead of aborting the batch.
    """
    try:
        probe = _live_probe(source_id, root=root)
    except SourceUnavailableError as exc:
        # EXTRA-4: missing manual drop is soft; network/API failures still raise.
        msg = str(exc).lower()
        if "manual" in msg or "missing" in msg or "no data file" in msg:
            return _missing_manual_row(source_id, root=root, err=str(exc))
        raise
    except ValueError as exc:
        return {
            "source": source_id,
            "checked_at": _now_iso(),
            "upstream_version": None,
            "upstream_changed_at": None,
            "ingested_version": _ingested_version(source_id, root=root, mode="live"),
            "stale": True,
            "mode": "live",
            "status": "no conectada",
            "note": str(exc),
        }
    ingested = _ingested_version(source_id, root=root, mode="live")
    upstream_version = str(probe["upstream_version"])
    return {
        "source": source_id,
        "checked_at": _now_iso(),
        "upstream_version": upstream_version,
        "upstream_changed_at": probe.get("upstream_changed_at"),
        "ingested_version": ingested,
        "stale": ingested != upstream_version,
        "mode": "live",
        "status": "ok",
        "note": probe.get("note"),
    }


def run_check(
    *,
    sources: list[str] | None = None,
    fixture_root: Path | None = None,
    root: Path | None = None,
    force: bool = False,  # noqa: ARG001 — reserved for cache bypass
) -> list[dict[str, Any]]:
    if sources is not None:
        selected = list(sources)
    elif fixture_root is not None:
        selected = list(PIPELINE_SOURCES)
    else:
        selected = list(KNOWN_CHECK_SOURCES)
    rows: list[dict[str, Any]] = []
    for source_id in selected:
        if source_id not in KNOWN_CHECK_SOURCES:
            raise ValueError(f"unknown pipeline source: {source_id}")
        if fixture_root is not None:
            if source_id not in PIPELINE_SOURCES:
                # EXTRA sources have no fixtures — soft-skip in offline mode.
                rows.append(
                    {
                        "source": source_id,
                        "checked_at": _now_iso(),
                        "upstream_version": None,
                        "upstream_changed_at": None,
                        "ingested_version": None,
                        "stale": True,
                        "mode": "fixture",
                        "status": "falta fichero (manual)",
                        "note": "no fixture for EXTRA freshness source",
                    },
                )
                continue
            rows.append(
                check_source_offline(source_id, fixture_root=fixture_root, root=root),
            )
        else:
            rows.append(check_source_live(source_id, root=root))

    out = freshness_path(root=root)
    out.parent.mkdir(parents=True, exist_ok=True)
    by_id: dict[str, dict[str, Any]] = {}
    known_set = set(KNOWN_CHECK_SOURCES)
    live_partial = fixture_root is None and set(selected) != known_set
    if out.is_file() and set(selected) != known_set:
        try:
            previous = json.loads(out.read_text(encoding="utf-8"))
            for old in previous.get("sources") or []:
                if not isinstance(old, dict) or "source" not in old:
                    continue
                # Live partial checks must not keep mini-/fixture leftovers that
                # would paint the whole freshness file as a fixture publish.
                if live_partial and old.get("mode") == "fixture":
                    continue
                by_id[str(old["source"])] = old
        except (json.JSONDecodeError, OSError):
            by_id = {}
    for row in rows:
        by_id[str(row["source"])] = row
    ordered = [by_id[sid] for sid in KNOWN_CHECK_SOURCES if sid in by_id]
    ordered += [by_id[sid] for sid in sorted(by_id) if sid not in known_set]
    # Pure comparison against locally stored terms snapshots (no network).
    ordered = annotate_terms_changed(ordered, root=root)
    checked = {str(r["source"]) for r in rows}
    rows = [r for r in ordered if str(r["source"]) in checked]
    modes = {str(r.get("mode") or "") for r in ordered}
    if modes == {"fixture"}:
        mode = "fixture"
    elif "live" in modes:
        mode = "live"
    else:
        mode = "fixture" if fixture_root is not None else "live"
    payload: dict[str, Any] = {
        "generated_at": _now_iso(),
        "mode": mode,
        "is_fixture": mode == "fixture",
        "sources": ordered,
    }
    baci_year = _baci_latest_year(root)
    if baci_year is not None:
        payload["latest_complete_year"] = baci_year
        payload["latest_partial_year"] = baci_year
    out.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return rows
