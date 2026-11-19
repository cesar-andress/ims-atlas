"""DAG runner: check -> extract -> validate -> transform with run log."""

from __future__ import annotations

import json
import time
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.access import AccessMode, access_mode_from_deployment, source_store
from imsatlas_etl.pipeline.changes import (
    append_history,
    history_entry,
    record_changes,
    update_variables_status,
)
from imsatlas_etl.pipeline.check import run_check
from imsatlas_etl.pipeline.extract import run_extract
from imsatlas_etl.pipeline.io_paths import PIPELINE_SOURCES, runs_dir
from imsatlas_etl.pipeline.lineage import write_lineage
from imsatlas_etl.pipeline.qa import run_qa
from imsatlas_etl.pipeline.stores import write_stores
from imsatlas_etl.pipeline.transform import run_transform
from imsatlas_etl.pipeline.validate import run_validate
from imsatlas_etl.sources import sources_by_id


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _timed(fn: Callable[[], Any]) -> tuple[Any, float]:
    start = time.perf_counter()
    result = fn()
    return result, time.perf_counter() - start


def _record_run_changes(
    run_id: str,
    mode: str,
    extracted: list[dict[str, Any]],
    *,
    root: Path | None,
) -> dict[str, Any] | None:
    if not extracted:
        return None
    return record_changes(run_id, mode=mode, results=extracted, root=root)


def _sources_for_access_mode(
    requested: list[str] | None,
    access_mode: AccessMode,
) -> list[str]:
    base = list(requested) if requested else list(PIPELINE_SOURCES)
    if access_mode == "CERRADO":
        return base
    try:
        registry = sources_by_id()
    except FileNotFoundError:
        # ATLAS_ROOT test worlds may omit catalog/; cannot filter abierta.
        return base
    return [
        sid
        for sid in base
        if source_store((registry.get(sid) or {}).get("rights")) == "abierta"
    ]


def run_pipeline(
    *,
    steps: list[str] | None = None,
    sources: list[str] | None = None,
    fixture_root: Path | None = None,
    root: Path | None = None,
    force: bool = False,
    access_mode: AccessMode | str | None = None,
) -> dict[str, Any]:
    """
    Run selected pipeline steps in DAG order.

    Mode is ``fixture`` when ``fixture_root`` is set, otherwise ``live``.
    Default steps: check, extract, validate, transform (fixture) and, in live
    mode, additionally qa and lineage. A QA block does not raise: the log
    status becomes ``qa_blocked`` so callers can map it to an exit code.

    ``access_mode`` ABIERTO runs only abierta sources; CERRADO runs all.
    After a full transform, curated tables are split into data/store/*.
    """
    order = ["check", "extract", "validate", "transform", "qa", "lineage", "stores"]
    mode = "fixture" if fixture_root is not None else "live"
    resolved_mode = (
        access_mode_from_deployment(override=str(access_mode))
        if access_mode is not None
        else access_mode_from_deployment(root=root)
    )
    for step in steps or []:
        if step not in order:
            raise ValueError(f"unknown step {step!r}; expected one of {order}")
    if steps is None:
        effective = (
            ["check", "extract", "validate", "transform", "qa", "lineage", "stores"]
            if mode == "live"
            else ["check", "extract", "validate", "transform", "stores"]
        )
    else:
        effective = [s for s in order if s in steps]

    selected_sources = _sources_for_access_mode(sources, resolved_mode)
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    log: dict[str, Any] = {
        "run_id": run_id,
        "started_at": _now_iso(),
        "sources": selected_sources,
        "access_mode": resolved_mode,
        "mode": mode,
        "is_fixture": mode == "fixture",
        "fixture_mode": fixture_root is not None,
        "force": force,
        "steps": {},
        "status": "running",
    }

    extracted: list[dict[str, Any]] = []
    try:
        if "check" in effective:
            result, dur = _timed(
                lambda: run_check(
                    sources=selected_sources,
                    fixture_root=fixture_root,
                    root=root,
                    force=force,
                ),
            )
            log["steps"]["check"] = {
                "status": "ok",
                "duration_s": round(dur, 4),
                "n_sources": len(result),
            }
        if "extract" in effective:
            result, dur = _timed(
                lambda: run_extract(
                    sources=selected_sources,
                    fixture_root=fixture_root,
                    root=root,
                    force=force,
                ),
            )
            log["steps"]["extract"] = {
                "status": "ok",
                "duration_s": round(dur, 4),
                "results": [
                    {
                        "source": r["source"],
                        "version": r["version"],
                        "skipped": r.get("skipped", False),
                        **{
                            k: r[k]
                            for k in ("rows", "countries", "years", "upstream_version")
                            if k in r
                        },
                    }
                    for r in result
                ],
            }
            extracted = result
        if "validate" in effective:
            result, dur = _timed(
                lambda: run_validate(sources=selected_sources, root=root, force=force),
            )
            log["steps"]["validate"] = {
                "status": "ok",
                "duration_s": round(dur, 4),
                "results": result,
            }
        # Transform/QA/lineage currently assume every PIPELINE_SOURCES version is
        # present in freshness (country_year merges WDI+WGI+LPI+hofstede, …).
        full_set = set(PIPELINE_SOURCES)
        subset_only = set(selected_sources) != full_set
        if "transform" in effective:
            if subset_only:
                log["steps"]["transform"] = {
                    "status": "skipped",
                    "reason": (
                        "selected sources are a subset of PIPELINE_SOURCES; "
                        "curated merge needs the full set"
                    ),
                }
            else:
                result, dur = _timed(lambda: run_transform(root=root, force=force))
                log["steps"]["transform"] = {
                    "status": "ok",
                    "duration_s": round(dur, 4),
                    "row_counts": result["row_counts"],
                }
        if "qa" in effective:
            if subset_only:
                log["steps"]["qa"] = {
                    "status": "skipped",
                    "reason": (
                        "skipped because transform did not run on a source subset"
                    ),
                }
            else:
                report, dur = _timed(lambda: run_qa(root=root))
                log["steps"]["qa"] = {
                    "status": "block" if report["status"] == "fail" else "ok",
                    "report_status": report["status"],
                    "duration_s": round(dur, 4),
                    "n_block": report["n_block"],
                    "n_warn": report["n_warn"],
                }
        if "lineage" in effective:
            if subset_only:
                log["steps"]["lineage"] = {
                    "status": "skipped",
                    "reason": (
                        "skipped because transform did not run on a source subset"
                    ),
                }
            else:
                path, dur = _timed(lambda: write_lineage(root=root))
                log["steps"]["lineage"] = {
                    "status": "ok",
                    "duration_s": round(dur, 4),
                }
        if "stores" in effective:
            transform_ok = log["steps"].get("transform", {}).get("status") == "ok"
            if not transform_ok:
                log["steps"]["stores"] = {
                    "status": "skipped",
                    "reason": "stores require a successful transform",
                }
            else:
                stores_report, dur = _timed(lambda: write_stores(root=root))
                log["steps"]["stores"] = {
                    "status": "ok",
                    "duration_s": round(dur, 4),
                    "stores": stores_report.get("stores"),
                }
        qa_blocked = log["steps"].get("qa", {}).get("status") == "block"
        log["status"] = "qa_blocked" if qa_blocked else "ok"
    except Exception as exc:
        log["status"] = "failed"
        log["error"] = str(exc)
        raise
    finally:
        log["ended_at"] = _now_iso()
        changes = _record_run_changes(run_id, mode, extracted, root=root)
        if changes is not None:
            log["changes_path"] = f"status/changes/{run_id}.json"
        out_dir = runs_dir(root=root)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{run_id}.json").write_text(
            json.dumps(log, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        log["run_log_path"] = str(out_dir / f"{run_id}.json")
        append_history(history_entry(log, changes), root=root)
        if mode == "live":
            update_variables_status(root=root)

    return log
