"""DAG runner: check -> extract -> validate -> transform with run log."""

from __future__ import annotations

import json
import time
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.check import run_check
from imsatlas_etl.pipeline.extract import run_extract
from imsatlas_etl.pipeline.io_paths import PIPELINE_SOURCES, runs_dir
from imsatlas_etl.pipeline.transform import run_transform
from imsatlas_etl.pipeline.validate import run_validate


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _timed(fn: Callable[[], Any]) -> tuple[Any, float]:
    start = time.perf_counter()
    result = fn()
    return result, time.perf_counter() - start


def run_pipeline(
    *,
    steps: list[str] | None = None,
    sources: list[str] | None = None,
    fixture_root: Path | None = None,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """
    Run selected pipeline steps in DAG order.

    Default steps: check, extract, validate, transform.
    """
    order = ["check", "extract", "validate", "transform"]
    selected_steps = list(steps) if steps else list(order)
    for step in selected_steps:
        if step not in order:
            raise ValueError(f"unknown step {step!r}; expected one of {order}")
    # Respect DAG ordering for selected steps.
    max_idx = max(order.index(s) for s in selected_steps)
    effective = order[: max_idx + 1]
    # But only execute explicitly requested steps if user narrowed; for `run` we do all.
    if steps is None:
        effective = order
    else:
        effective = [s for s in order if s in selected_steps]

    selected_sources = list(sources) if sources else list(PIPELINE_SOURCES)
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    log: dict[str, Any] = {
        "run_id": run_id,
        "started_at": _now_iso(),
        "sources": selected_sources,
        "fixture_mode": fixture_root is not None,
        "force": force,
        "steps": {},
        "status": "running",
    }

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
                    }
                    for r in result
                ],
            }
        if "validate" in effective:
            result, dur = _timed(
                lambda: run_validate(sources=selected_sources, root=root, force=force),
            )
            log["steps"]["validate"] = {
                "status": "ok",
                "duration_s": round(dur, 4),
                "results": result,
            }
        if "transform" in effective:
            result, dur = _timed(lambda: run_transform(root=root, force=force))
            log["steps"]["transform"] = {
                "status": "ok",
                "duration_s": round(dur, 4),
                "row_counts": result["row_counts"],
            }
        log["status"] = "ok"
    except Exception as exc:
        log["status"] = "failed"
        log["error"] = str(exc)
        raise
    finally:
        log["ended_at"] = _now_iso()
        out_dir = runs_dir(root=root)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{run_id}.json").write_text(
            json.dumps(log, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        log["run_log_path"] = str(out_dir / f"{run_id}.json")

    return log
