"""Per-source pipeline state (`status/sources_state.json`) for hourly runs (R-0)."""

from __future__ import annotations

import json
import os
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from imsatlas_etl.pipeline.io_paths import status_root

STATE_NAME = "sources_state.json"


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sources_state_path(*, root: Path | None = None) -> Path:
    return status_root(root=root) / STATE_NAME


def load_sources_state(*, root: Path | None = None) -> dict[str, Any]:
    path = sources_state_path(root=root)
    if not path.is_file():
        return {"generated_at": None, "sources": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def save_sources_state(payload: dict[str, Any], *, root: Path | None = None) -> Path:
    path = sources_state_path(root=root)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["generated_at"] = _now()
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return path


def update_source_state(
    source_id: str,
    *,
    root: Path | None = None,
    checked_at: str | None = None,
    last_ok_at: str | None = None,
    version: str | None = None,
    rows: int | None = None,
    last_year: int | None = None,
    error: str | None = None,
    status: str | None = None,
    tier: str | None = None,
    consecutive_failures: int | None = None,
    check_count_delta: int = 0,
) -> dict[str, Any]:
    """Merge one source row; returns the updated row."""
    payload = load_sources_state(root=root)
    sources: dict[str, Any] = dict(payload.get("sources") or {})
    row: dict[str, Any] = dict(sources.get(source_id) or {})
    if checked_at is not None:
        row["checked_at"] = checked_at
    if last_ok_at is not None:
        row["last_ok_at"] = last_ok_at
    if version is not None:
        row["version"] = version
    if rows is not None:
        row["rows"] = rows
    if last_year is not None:
        row["last_year"] = last_year
    if error is not None:
        row["error"] = error
    elif status in {"ok", "al_dia", "fresh"}:
        row["error"] = None
    if status is not None:
        row["status"] = status
    if tier is not None:
        row["tier"] = tier
    if consecutive_failures is not None:
        row["consecutive_failures"] = consecutive_failures
    if check_count_delta:
        row["check_count"] = int(row.get("check_count") or 0) + check_count_delta
    row["updated_at"] = _now()
    sources[source_id] = row
    payload["sources"] = sources
    save_sources_state(payload, root=root)
    return row


# Waiting for a manual drop or connector is not a hard failure: do not bump
# consecutive_failures or send alert email (PROMPTS URGENTE §5).
_NON_FAILURE_STATUSES = frozenset(
    {"pending_file", "no_connector", "skipped", "daily_cap"},
)


def mark_check(
    source_id: str,
    *,
    root: Path | None = None,
    ok: bool,
    version: str | None = None,
    rows: int | None = None,
    last_year: int | None = None,
    error: str | None = None,
    status: str | None = None,
    tier: str | None = None,
) -> dict[str, Any]:
    """Record one hourly check; bump consecutive failures and optionally email."""
    payload = load_sources_state(root=root)
    prev = dict((payload.get("sources") or {}).get(source_id) or {})
    fails = int(prev.get("consecutive_failures") or 0)
    st = status or ("ok" if ok else "fail")
    if ok:
        fails = 0
        last_ok = _now()
        err = None
        st = status or "ok"
    elif st in _NON_FAILURE_STATUSES:
        # Keep prior failure count (do not inflate from missing files).
        last_ok = prev.get("last_ok_at")
        err = error
    else:
        fails += 1
        last_ok = prev.get("last_ok_at")
        err = error or "check/extract failed"
        st = status or "fail"
    row = update_source_state(
        source_id,
        root=root,
        checked_at=_now(),
        last_ok_at=last_ok if isinstance(last_ok, str) else None,
        version=version if version is not None else prev.get("version"),
        rows=rows if rows is not None else prev.get("rows"),
        last_year=last_year if last_year is not None else prev.get("last_year"),
        error=err,
        status=st,
        tier=tier if tier is not None else prev.get("tier"),
        consecutive_failures=fails,
        check_count_delta=1,
    )
    if fails == 3 and st not in _NON_FAILURE_STATUSES:
        maybe_send_failure_email(source_id, row)
    return row


def maybe_send_failure_email(source_id: str, row: dict[str, Any]) -> bool:
    """Send alert when configured via check.env (never commit secrets)."""
    to_addr = (os.environ.get("ATLAS_ALERT_EMAIL") or "").strip()
    if not to_addr:
        return False
    host = (os.environ.get("ATLAS_ALERT_SMTP_HOST") or "").strip()
    if not host:
        # Log-only fallback: write a marker under status/
        return False
    port = int(os.environ.get("ATLAS_ALERT_SMTP_PORT") or "587")
    user = (os.environ.get("ATLAS_ALERT_SMTP_USER") or "").strip()
    password = os.environ.get("ATLAS_ALERT_SMTP_PASSWORD") or ""
    from_addr = (os.environ.get("ATLAS_ALERT_FROM") or user or to_addr).strip()
    msg = EmailMessage()
    msg["Subject"] = f"[IMS Atlas] Fuente en rojo: {source_id}"
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(
        (
            f"La fuente {source_id} lleva "
            f"{row.get('consecutive_failures')} fallos seguidos.\n"
            f"Estado: {row.get('status')}\n"
            f"Error: {row.get('error')}\n"
            f"Última comprobación: {row.get('checked_at')}\n"
            f"Ver: https://atlas.aiserv.es/status\n"
        ),
    )
    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except OSError:
        return False


def summarize_by_tier(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = payload or load_sources_state()
    sources = data.get("sources") or {}
    by_tier: dict[str, dict[str, int]] = {}
    for row in sources.values():
        if not isinstance(row, dict):
            continue
        tier = str(row.get("tier") or "?")
        bucket = by_tier.setdefault(
            tier,
            {"total": 0, "ok": 0, "fail": 0, "pending": 0},
        )
        bucket["total"] += 1
        st = str(row.get("status") or "")
        if st in {"ok", "al_dia", "fresh"} and not row.get("error"):
            bucket["ok"] += 1
        elif st in {"fail", "error", "rojo"} or row.get("consecutive_failures", 0) >= 3:
            bucket["fail"] += 1
        else:
            bucket["pending"] += 1
    ok = sum(
        1
        for r in sources.values()
        if isinstance(r, dict)
        and r.get("status") in {"ok", "al_dia", "fresh"}
        and not r.get("error")
    )
    return {
        "ok": ok,
        "total": len(sources),
        "by_tier": by_tier,
    }
