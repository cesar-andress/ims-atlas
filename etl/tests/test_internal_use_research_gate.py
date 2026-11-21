"""Internal release includes use_research=yes without requiring evidence."""

from __future__ import annotations

import copy

from imsatlas_etl.pipeline.release import _use_research_ok, _variable_gates


def test_use_research_ok_can_skip_evidence() -> None:
    registry = {
        "kof_globalisation": {
            "rights": {
                "use_research": "yes",
                "evidence": {
                    "checked_by": None,
                    "checked_on": None,
                    "terms_url": "https://example.invalid/",
                    "snapshot_sha256": None,
                },
            },
        },
    }
    variable = {"id": "GLIN", "source_ids": ["kof_globalisation"]}
    assert _use_research_ok(variable, registry, require_evidence=True) is False
    assert _use_research_ok(variable, registry, require_evidence=False) is True


def test_internal_includes_use_research_without_evidence(monkeypatch) -> None:
    from imsatlas_etl.pipeline import release as release_mod

    catalog = copy.deepcopy(release_mod.load_catalog())
    registry = copy.deepcopy(release_mod.sources_by_id())
    # Pick a byod_only research source with incomplete evidence if present.
    target = None
    for var in catalog["variables"]:
        sids = list(var.get("source_ids") or [])
        if not sids:
            continue
        rights = (registry.get(sids[0]) or {}).get("rights") or {}
        if rights.get("use_research") == "yes" and not release_mod.evidence_present(
            rights,
        ):
            target = var["id"]
            break
    if target is None:
        # Synthetic: force incomplete evidence on GLIN's source.
        target = "GLIN"
        for var in catalog["variables"]:
            if var["id"] == "GLIN":
                var["source_ids"] = ["kof_globalisation"]
                break
        registry["kof_globalisation"] = {
            "rights": {
                "use_research": "yes",
                "redistribute_raw": "no",
                "redistribute_derived": "unknown",
                "commercial_use": "no",
                "attribution_required": "yes",
                "share_alike": "no",
                "no_derivatives": "unknown",
                "evidence": {
                    "checked_by": None,
                    "checked_on": None,
                    "terms_url": "https://example.invalid/",
                    "snapshot_sha256": None,
                },
            },
        }

    monkeypatch.setattr(release_mod, "load_catalog", lambda: catalog)
    monkeypatch.setattr(release_mod, "sources_by_id", lambda: registry)

    def fake_gate(variable, *, registry, deployment):  # noqa: ANN001, ARG001
        return {
            "decision": "byod_only",
            "reasons": ["test"],
            "share_alike": False,
        }

    monkeypatch.setattr(release_mod, "gate_for_variable", fake_gate)

    public = {r["id"]: r for r in _variable_gates(audience="public")}
    internal = {r["id"]: r for r in _variable_gates(audience="internal")}
    assert public[target]["included"] is False
    assert internal[target]["included"] is True
