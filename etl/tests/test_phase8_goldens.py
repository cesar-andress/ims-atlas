"""Phase 8 golden export writes COL HS64 ranking fixtures."""

from __future__ import annotations

import json
from pathlib import Path

from imsatlas_etl.export_phase8_goldens import (
    default_output_paths,
    write_phase8_goldens,
)


def test_write_phase8_goldens(tmp_path: Path) -> None:
    out = tmp_path / "phase8.json"
    path = write_phase8_goldens(out)
    assert path == out
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["spec"] == "phase8"
    block = payload["block"]
    assert block["origin"] == "COL"
    assert block["hs"] == "64"
    assert block["year"] == 2023
    assert len(block["candidates"]) == 60
    assert len(block["ranking_expert"]) == 60
    assert block["ranking_expert"][0]["rank"] == 1
    # Expert factor weights must not be uniform (demand/openness residual).
    factors = block["weights_expert"]["factors"]
    vals = list(factors.values())
    assert max(vals) - min(vals) > 1e-6


def test_default_output_paths_exist_after_write() -> None:
    core_path, app_path = default_output_paths()
    write_phase8_goldens()
    assert core_path.is_file()
    assert app_path.is_file()
    app = json.loads(app_path.read_text(encoding="utf-8"))
    # Browser payload stays lean (no recomputable matrices).
    assert "prepared_matrix" not in app["block"]
    assert "raw" in app["block"]
    assert "ranking_expert" in app["block"]
    assert app_path.stat().st_size < core_path.stat().st_size
