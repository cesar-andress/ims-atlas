from __future__ import annotations

import json

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from imsatlas_etl.gate import RIGHTS_FLAGS, gate
from imsatlas_etl.paths import gate_cases_path

CASES = json.loads(gate_cases_path().read_text(encoding="utf-8"))

YES_NO_UNKNOWN = st.sampled_from(["yes", "no", "unknown"])


def _rights(
    *,
    use_research="yes",
    redistribute_raw="yes",
    redistribute_derived="yes",
    commercial_use="yes",
    attribution_required="yes",
    share_alike="no",
    no_derivatives="no",
    evidence_complete=True,
):
    evidence = {
        "checked_by": "Tester" if evidence_complete else None,
        "checked_on": "2026-11-19" if evidence_complete else None,
        "terms_url": "https://example.test/terms",
        "snapshot_sha256": "abc" if evidence_complete else None,
    }
    return {
        "licence_id": "CC-BY-4.0",
        "use_research": use_research,
        "redistribute_raw": redistribute_raw,
        "redistribute_derived": redistribute_derived,
        "commercial_use": commercial_use,
        "attribution_required": attribution_required,
        "share_alike": share_alike,
        "no_derivatives": no_derivatives,
        "evidence": evidence,
    }


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_shared_gate_cases(case: dict) -> None:
    result = gate(case["source_rights"], case["variable"], case["deployment"])
    assert result["decision"] == case["expected_decision"]


@given(
    flag=st.sampled_from(list(RIGHTS_FLAGS)),
    rest=st.fixed_dictionaries(
        {name: YES_NO_UNKNOWN for name in RIGHTS_FLAGS},
    ),
)
@settings(max_examples=80)
def test_any_unknown_never_ships(flag: str, rest: dict) -> None:
    rights = _rights(**{**rest, flag: "unknown"}, evidence_complete=True)
    result = gate(rights, None, {"commercial_context": True})
    assert result["decision"] not in {"ship_raw", "ship_derived"}


@given(derived=YES_NO_UNKNOWN, raw=YES_NO_UNKNOWN)
@settings(max_examples=40)
def test_no_derivatives_never_ship_derived(derived: str, raw: str) -> None:
    rights = _rights(
        redistribute_raw=raw,
        redistribute_derived=derived,
        no_derivatives="yes",
        evidence_complete=True,
    )
    # Force known non-unknown flags for the property under test
    for name in RIGHTS_FLAGS:
        if rights[name] == "unknown":
            rights[name] = "no" if name != "use_research" else "yes"
    rights["no_derivatives"] = "yes"
    rights["redistribute_raw"] = raw if raw != "unknown" else "no"
    rights["redistribute_derived"] = derived if derived != "unknown" else "yes"
    rights["commercial_use"] = "yes"
    rights["use_research"] = "yes"
    rights["attribution_required"] = "yes"
    rights["share_alike"] = "no"
    result = gate(rights, None, {"commercial_context": True})
    assert result["decision"] != "ship_derived"


def test_commercial_no_never_ships_under_commercial_context() -> None:
    rights = _rights(commercial_use="no", evidence_complete=True)
    result = gate(rights, None, {"commercial_context": True})
    assert result["decision"] not in {"ship_raw", "ship_derived"}
