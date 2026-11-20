"""Shared fixtures: mini_world pipeline root and a release with real cells."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from imsatlas_etl.pipeline import release as release_mod
from imsatlas_etl.pipeline.runner import run_pipeline

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_world"

# Variables whose raw sources exist in mini_world (all byod_only in the real gate).
CELL_VARIABLES = frozenset({"CO2PC", "PLI", "ITU_IDI", "DIST", "LANG", "FTA", "TARIF"})


@pytest.fixture()
def world_root(tmp_path: Path) -> Path:
    """Fixture pipeline run into an isolated root (curated + raw + freshness)."""
    run_pipeline(
        steps=["check", "extract", "validate", "transform"],
        fixture_root=FIXTURE_ROOT,
        root=tmp_path,
        force=True,
    )
    return tmp_path


@pytest.fixture()
def ship_cell_variables(monkeypatch: pytest.MonkeyPatch) -> frozenset[str]:
    """Test-only: let the gate ship CELL_VARIABLES so releases carry cells."""
    original = release_mod._variable_gates

    def gates(*, audience: str = "public") -> list[dict[str, Any]]:
        rows = original(audience=audience)
        for row in rows:
            if row["id"] in CELL_VARIABLES:
                row["included"] = True
                row["decision"] = "ship_derived"
        return rows

    monkeypatch.setattr(release_mod, "_variable_gates", gates)
    return CELL_VARIABLES


@pytest.fixture()
def no_ship_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test-only: behave as if no source were attested (empty-release behaviour).

    The real catalog ships attested open sources since CA's rights-verify run
    (2026-11-20), so empty-release tests force the pre-attestation state.
    """
    from imsatlas_etl import gate as gate_mod

    monkeypatch.setattr(gate_mod, "evidence_present", lambda _rights: False)
