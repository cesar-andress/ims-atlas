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
    core_path, e2e_path, public_path = default_output_paths()
    write_phase8_goldens()
    assert core_path.is_file()
    assert e2e_path.is_file()
    assert public_path.is_file()
    e2e = json.loads(e2e_path.read_text(encoding="utf-8"))
    public = json.loads(public_path.read_text(encoding="utf-8"))
    # Full panel (private e2e) keeps TARIF/CULT; public demo must not.
    e2e_ids = [v["id"] for v in e2e["block"]["variables"]]
    pub_ids = [v["id"] for v in public["block"]["variables"]]
    assert "TARIF" in e2e_ids and "CULT" in e2e_ids
    assert "TARIF" not in pub_ids and "CULT" not in pub_ids
    for row in public["block"]["raw"]:
        assert "TARIF" not in row and "CULT" not in row
    assert public["block"]["excluded_byod"]
    # Browser payload stays lean (no recomputable matrices).
    assert "prepared_matrix" not in public["block"]
    assert "raw" in public["block"]
    assert "ranking_expert" in public["block"]
    assert public_path.stat().st_size < core_path.stat().st_size
    assert e2e_path.stat().st_size < core_path.stat().st_size
