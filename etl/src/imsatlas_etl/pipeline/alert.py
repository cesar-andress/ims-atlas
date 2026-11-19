"""Freshness alerts after scheduled check (log + optional GitHub issue)."""

from __future__ import annotations

import json
import os
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.io_paths import freshness_path, status_root


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_stale_alert(
    rows: list[dict[str, Any]],
    *,
    root: Path | None = None,
) -> Path | None:
    stale = [r for r in rows if r.get("stale")]
    out_dir = status_root(root=root)
    out_dir.mkdir(parents=True, exist_ok=True)
    alert_path = out_dir / "alert.json"
    if not stale:
        if alert_path.is_file():
            alert_path.unlink()
        return None
    payload = {
        "generated_at": _now_iso(),
        "n_stale": len(stale),
        "sources": stale,
        "message": "One or more sources are stale relative to ingested_version",
    }
    alert_path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    log_path = out_dir / "alert.log"
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(
            f"{payload['generated_at']} stale={len(stale)} "
            f"sources={[s['source'] for s in stale]}\n",
        )
    return alert_path


def maybe_open_github_issue(alert_path: Path) -> str | None:
    """
    Optionally open a GitHub issue via `gh` when GITHUB_TOKEN is set.

    Never prints or logs the token value.
    """
    if not os.environ.get("GITHUB_TOKEN") and not os.environ.get("GH_TOKEN"):
        return None
    if not alert_path.is_file():
        return None
    body = alert_path.read_text(encoding="utf-8")
    title = f"IMS Atlas: stale sources ({_now_iso()})"
    try:
        result = subprocess.run(
            [
                "gh",
                "issue",
                "create",
                "--title",
                title,
                "--body",
                f"Automated freshness alert.\n\n```json\n{body}\n```\n",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return f"gh unavailable: {exc}"
    if result.returncode != 0:
        return f"gh failed (exit {result.returncode})"
    return result.stdout.strip() or "issue created"


def check_and_alert(
    *,
    fixture_root: Path | None = None,
    root: Path | None = None,
    open_issue: bool = False,
) -> dict[str, Any]:
    from imsatlas_etl.pipeline.check import run_check

    rows = run_check(fixture_root=fixture_root, root=root)
    alert = write_stale_alert(rows, root=root)
    issue = None
    if open_issue and alert is not None:
        issue = maybe_open_github_issue(alert)
    return {
        "n_sources": len(rows),
        "n_stale": sum(1 for r in rows if r.get("stale")),
        "alert_path": str(alert) if alert else None,
        "freshness_path": str(freshness_path(root=root)),
        "github_issue": issue,
    }
