"""Public release includes variables only after status: verified (SPEC §4)."""

from __future__ import annotations

import copy

from imsatlas_etl.pipeline.release import _variable_gates, load_catalog


def test_variable_gates_public_requires_verified(monkeypatch) -> None:
    """Draft ship_raw stays excluded; verified ship_raw is included."""
    from imsatlas_etl.pipeline import release as release_mod

    def fake_gate(variable, *, registry, deployment):  # noqa: ANN001
        return {
            "decision": "ship_raw",
            "reasons": ["test"],
            "share_alike": False,
        }

    monkeypatch.setattr(release_mod, "gate_for_variable", fake_gate)

    catalog = copy.deepcopy(load_catalog())
    target = catalog["variables"][0]["id"]
    for var in catalog["variables"]:
        var["status"] = "draft"
    monkeypatch.setattr(release_mod, "load_catalog", lambda: catalog)

    draft_rows = _variable_gates(audience="public")
    assert all(not r["included"] for r in draft_rows)

    for var in catalog["variables"]:
        if var["id"] == target:
            var["status"] = "verified"

    verified_rows = _variable_gates(audience="public")
    included = [r for r in verified_rows if r["included"]]
    assert any(r["id"] == target for r in included)
    assert len(included) >= 1
