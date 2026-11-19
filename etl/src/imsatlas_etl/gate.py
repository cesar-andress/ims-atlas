"""Licence gate (SPEC §10.2). Pure function; mirrored in core/src/gate.ts."""

from __future__ import annotations

from typing import Any, Literal

YesNoUnknown = Literal["yes", "no", "unknown"]
Decision = Literal["ship_raw", "ship_derived", "byod_only", "local_only"]

RIGHTS_FLAGS = (
    "use_research",
    "redistribute_raw",
    "redistribute_derived",
    "commercial_use",
    "attribution_required",
    "share_alike",
    "no_derivatives",
)

_DECISION_RANK: dict[Decision, int] = {
    "local_only": 0,
    "byod_only": 1,
    "ship_derived": 2,
    "ship_raw": 3,
}


def evidence_present(rights: dict[str, Any]) -> bool:
    evidence = rights.get("evidence")
    if not isinstance(evidence, dict):
        return False
    checked_by = evidence.get("checked_by")
    checked_on = evidence.get("checked_on")
    terms_url = evidence.get("terms_url")
    snapshot = evidence.get("snapshot_sha256")
    return bool(
        isinstance(checked_by, str)
        and checked_by.strip()
        and isinstance(checked_on, str)
        and checked_on.strip()
        and isinstance(terms_url, str)
        and terms_url.strip()
        and isinstance(snapshot, str)
        and snapshot.strip(),
    )


def _flag(rights: dict[str, Any], key: str) -> YesNoUnknown:
    value = rights.get(key, "unknown")
    if value in ("yes", "no", "unknown"):
        return value  # type: ignore[return-value]
    return "unknown"


def _commercial_ok(rights: dict[str, Any], deployment: dict[str, Any]) -> bool:
    commercial_use = _flag(rights, "commercial_use")
    commercial_context = bool(deployment.get("commercial_context", True))
    if commercial_use == "yes":
        return True
    if not commercial_context:
        return True
    return False


def _merge_variable_override(
    source_rights: dict[str, Any],
    variable: dict[str, Any] | None,
) -> dict[str, Any]:
    """Apply optional variable.rights override (must include override_reason)."""
    if not variable:
        return dict(source_rights)
    override = variable.get("rights")
    if not isinstance(override, dict):
        return dict(source_rights)
    reason = override.get("override_reason")
    if not isinstance(reason, str) or not reason.strip():
        return dict(source_rights)
    merged = dict(source_rights)
    for key, value in override.items():
        if key == "override_reason":
            continue
        if key == "evidence" and isinstance(value, dict):
            base_ev = dict(merged.get("evidence") or {})
            base_ev.update(value)
            merged["evidence"] = base_ev
        else:
            merged[key] = value
    return merged


def gate_one(
    source_rights: dict[str, Any],
    variable: dict[str, Any] | None,
    deployment: dict[str, Any],
) -> dict[str, Any]:
    """Gate a single rights record. Returns {decision, reasons, share_alike}."""
    rights = _merge_variable_override(source_rights, variable)
    reasons: list[str] = []

    unknowns = [name for name in RIGHTS_FLAGS if _flag(rights, name) == "unknown"]
    if unknowns:
        reasons.append("unknown rights: " + ", ".join(unknowns))

    if not evidence_present(rights):
        reasons.append(
            "evidence incomplete (checked_by/on, terms_url, snapshot_sha256)",
        )

    use_research = _flag(rights, "use_research")
    if use_research == "no":
        reasons.append("use_research=no")
        return {
            "decision": "local_only",
            "reasons": reasons,
            "share_alike": _flag(rights, "share_alike") == "yes",
        }

    if unknowns or not evidence_present(rights):
        return {
            "decision": "byod_only",
            "reasons": reasons,
            "share_alike": _flag(rights, "share_alike") == "yes",
        }

    if not _commercial_ok(rights, deployment):
        reasons.append(
            "commercial_use=no under commercial_context=true",
        )
        return {
            "decision": "byod_only",
            "reasons": reasons,
            "share_alike": _flag(rights, "share_alike") == "yes",
        }

    raw_ok = _flag(rights, "redistribute_raw") == "yes"
    derived_flag = _flag(rights, "redistribute_derived")
    no_derivatives = _flag(rights, "no_derivatives") == "yes"
    derived_ok = (derived_flag == "yes" or raw_ok) and not no_derivatives

    if no_derivatives and derived_flag == "yes":
        reasons.append("no_derivatives=yes blocks ship_derived")

    if raw_ok:
        reasons.append("redistribute_raw=yes with evidence and commercial ok")
        return {
            "decision": "ship_raw",
            "reasons": reasons,
            "share_alike": _flag(rights, "share_alike") == "yes",
        }

    if derived_ok:
        reasons.append("redistribute_derived allowed with evidence and commercial ok")
        return {
            "decision": "ship_derived",
            "reasons": reasons,
            "share_alike": _flag(rights, "share_alike") == "yes",
        }

    if _flag(rights, "redistribute_raw") == "no":
        reasons.append("redistribute_raw=no")
    if derived_flag == "no" or no_derivatives:
        reasons.append("derived redistribution not allowed")

    return {
        "decision": "byod_only",
        "reasons": reasons or ["redistribution not permitted"],
        "share_alike": _flag(rights, "share_alike") == "yes",
    }


def gate(
    source_rights: dict[str, Any] | list[dict[str, Any]],
    variable: dict[str, Any] | None,
    deployment: dict[str, Any],
) -> dict[str, Any]:
    """
    Gate one or many source rights records.

    Multiple sources: take the most restrictive decision and concatenate reasons.
    """
    records: list[dict[str, Any]]
    if isinstance(source_rights, list):
        if not source_rights:
            return {
                "decision": "byod_only",
                "reasons": ["no source rights provided"],
                "share_alike": False,
            }
        records = source_rights
    else:
        records = [source_rights]

    results = [gate_one(r, variable, deployment) for r in records]
    worst = min(results, key=lambda r: _DECISION_RANK[r["decision"]])  # type: ignore[index]
    reasons: list[str] = []
    for index, result in enumerate(results):
        prefix = f"source[{index}]" if len(results) > 1 else ""
        for reason in result["reasons"]:
            reasons.append(f"{prefix}: {reason}" if prefix else reason)
    share_alike = any(bool(r.get("share_alike")) for r in results)
    return {
        "decision": worst["decision"],
        "reasons": reasons,
        "share_alike": share_alike,
    }
