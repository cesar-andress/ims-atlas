"""Hourly per-source check/extract with resume and rate limits (R-0 / R-1)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.check import check_source_live, run_check
from imsatlas_etl.pipeline.extract import extract_source
from imsatlas_etl.pipeline.io_paths import (
    EXTRA_FRESHNESS_SOURCES,
    PIPELINE_SOURCES,
    freshness_path,
    raw_source_dir,
)
from imsatlas_etl.pipeline.sources_state import (
    load_sources_state,
    mark_check,
    summarize_by_tier,
)
from imsatlas_etl.sources import sources_by_id

# Sources that must not be polled every hour (publisher / API daily caps).
DAILY_ONLY = frozenset(
    {
        "un_comtrade",
        "wits_trains",
        "wto_tariffs",
        "wto_eping",
    }
)

# Soft max wall time per hourly tick (leave headroom for BACI chunks).
DEFAULT_BUDGET_S = 45 * 60


def _now() -> datetime:
    return datetime.now(UTC)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _tier_for(source_id: str, registry: dict[str, Any]) -> str:
    meta = registry.get(source_id) or {}
    tier = meta.get("tier")
    if isinstance(tier, str) and tier in {"A", "B", "C"}:
        return tier
    return "?"


def _count_rows(source_id: str, version: str, *, root: Path | None) -> int | None:
    base = raw_source_dir(source_id, version, root=root)
    for name in (
        "indicators.csv",
        "trade.csv",
        "bilateral.csv",
        "tariffs.csv",
        "dimensions.csv",
        "values.csv",
        "events.csv",
        "fairs.csv",
    ):
        path = base / name
        if path.is_file():
            try:
                # cheap line count without loading pandas
                with path.open("rb") as fh:
                    return max(sum(1 for _ in fh) - 1, 0)
            except OSError:
                return None
    return None


def _should_skip_today(source_id: str, state_row: dict[str, Any]) -> bool:
    if source_id not in DAILY_ONLY:
        return False
    last = _parse_iso(state_row.get("checked_at"))
    if last is None:
        return False
    return last.date() == _now().date() and state_row.get("status") in {
        "ok",
        "al_dia",
        "fresh",
    }


def known_hourly_sources() -> list[str]:
    return list(dict.fromkeys([*PIPELINE_SOURCES, *EXTRA_FRESHNESS_SOURCES]))


def run_hourly(
    *,
    root: Path | None = None,
    force: bool = False,
    sources: list[str] | None = None,
    budget_s: int = DEFAULT_BUDGET_S,
    extract: bool = True,
) -> dict[str, Any]:
    """
    One hourly tick: check each source; download only when stale or previously failed.

    Failures are isolated. Large extracts rely on connector-level skip/checkpoint
    (existing ``force=False`` skip when the table already exists).
    """
    started = _now()
    registry = {}
    try:
        registry = sources_by_id()
    except FileNotFoundError:
        registry = {}

    selected = list(sources) if sources else known_hourly_sources()
    # Ensure freshness has rows for selected sources (partial merge).
    run_check(sources=selected, root=root, force=force)
    freshness = json.loads(freshness_path(root=root).read_text(encoding="utf-8"))
    by_fresh = {row["source"]: row for row in freshness.get("sources", [])}

    state = load_sources_state(root=root)
    results: list[dict[str, Any]] = []

    for source_id in selected:
        if (_now() - started).total_seconds() > budget_s:
            results.append(
                {
                    "source": source_id,
                    "skipped": True,
                    "reason": "hourly budget exhausted; will resume next hour",
                },
            )
            continue

        tier = _tier_for(source_id, registry)
        prev = dict((state.get("sources") or {}).get(source_id) or {})
        if _should_skip_today(source_id, prev) and not force:
            mark_check(
                source_id,
                root=root,
                ok=True,
                version=prev.get("version"),
                rows=prev.get("rows"),
                last_year=prev.get("last_year"),
                status="ok",
                tier=tier,
            )
            results.append(
                {
                    "source": source_id,
                    "skipped": True,
                    "reason": "daily cap",
                },
            )
            continue

        try:
            row = by_fresh.get(source_id) or check_source_live(source_id, root=root)
        except Exception as exc:  # noqa: BLE001 — isolate sources
            mark_check(
                source_id,
                root=root,
                ok=False,
                error=str(exc),
                status="fail",
                tier=tier,
            )
            results.append({"source": source_id, "ok": False, "error": str(exc)})
            continue

        status = str(row.get("status") or "")
        stale = bool(row.get("stale"))
        version = row.get("upstream_version") or row.get("ingested_version")
        need_extract = extract and (
            force
            or stale
            or row.get("ingested_version") is None
            or status.startswith("falta")
            or int(prev.get("consecutive_failures") or 0) > 0
        )

        if status.startswith("falta") or status == "no conectada":
            mark_check(
                source_id,
                root=root,
                ok=False,
                version=str(version) if version else None,
                error=str(row.get("note") or status),
                status="pending_file" if status.startswith("falta") else "no_connector",
                tier=tier,
            )
            results.append({"source": source_id, "ok": False, "status": status})
            continue

        if need_extract and version:
            try:
                extracted = extract_source(
                    source_id,
                    str(version),
                    fixture_root=None,
                    root=root,
                    force=force,
                )
                if extracted.get("missing"):
                    mark_check(
                        source_id,
                        root=root,
                        ok=False,
                        version=str(version),
                        error=str(extracted.get("reason") or "extract missing"),
                        status="fail",
                        tier=tier,
                    )
                    results.append(
                        {
                            "source": source_id,
                            "ok": False,
                            "error": extracted.get("reason"),
                        },
                    )
                    continue
                rows = _count_rows(source_id, str(version), root=root)
                mark_check(
                    source_id,
                    root=root,
                    ok=True,
                    version=str(version),
                    rows=rows,
                    status="ok",
                    tier=tier,
                )
                # Refresh freshness ingested_version for this source.
                for fr in freshness.get("sources", []):
                    if fr.get("source") == source_id:
                        fr["ingested_version"] = str(version)
                        fr["stale"] = fr.get("upstream_version") != str(version)
                results.append(
                    {
                        "source": source_id,
                        "ok": True,
                        "extracted": True,
                        "rows": rows,
                        "version": version,
                    },
                )
            except Exception as exc:  # noqa: BLE001
                mark_check(
                    source_id,
                    root=root,
                    ok=False,
                    version=str(version),
                    error=str(exc),
                    status="fail",
                    tier=tier,
                )
                results.append({"source": source_id, "ok": False, "error": str(exc)})
            continue

        # Check-only (already fresh).
        rows = None
        if version:
            rows = _count_rows(source_id, str(version), root=root)
        mark_check(
            source_id,
            root=root,
            ok=True,
            version=str(version) if version else None,
            rows=rows,
            status="ok",
            tier=tier,
        )
        results.append(
            {
                "source": source_id,
                "ok": True,
                "extracted": False,
                "version": version,
                "rows": rows,
            },
        )

    freshness_path(root=root).write_text(
        json.dumps(freshness, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    summary = summarize_by_tier(load_sources_state(root=root))
    out = {
        "started_at": started.isoformat().replace("+00:00", "Z"),
        "ended_at": _now().isoformat().replace("+00:00", "Z"),
        "n_sources": len(selected),
        "n_ok": sum(1 for r in results if r.get("ok")),
        "n_fail": sum(1 for r in results if r.get("ok") is False),
        "summary": summary,
        "results": results,
    }
    # Keep a short run log next to state.
    log_path = freshness_path(root=root).parent / "hourly_last.json"
    log_path.write_text(
        json.dumps(out, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return out
