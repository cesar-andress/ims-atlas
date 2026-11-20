"""Phase 8 golden export writes synthetic fixtures + public pending stub."""

from __future__ import annotations

import json
from pathlib import Path

from imsatlas_etl.export_phase8_goldens import (
    default_output_paths,
    write_phase8_goldens,
)
from imsatlas_etl.paths import repo_root


def test_write_phase8_goldens(tmp_path: Path) -> None:
    out = tmp_path / "phase8.json"
    path = write_phase8_goldens(out)
    assert path == out
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["spec"] == "phase8"
    assert payload["synthetic"] is True
    block = payload["block"]
    assert block["origin"] == "COL"
    assert block["hs"] == "64"
    assert block["year"] == 2023
    assert len(block["candidates"]) == 60
    assert len(block["ranking_expert"]) == 60
    assert block["ranking_expert"][0]["rank"] == 1
    factors = block["weights_expert"]["factors"]
    vals = list(factors.values())
    assert max(vals) - min(vals) > 1e-6


def test_default_output_paths_after_write() -> None:
    core_path, e2e_path, public_path = default_output_paths()
    write_phase8_goldens()
    assert core_path.is_file()
    assert e2e_path.is_file()
    assert public_path.is_file()
    assert "synthetic" in core_path.name
    assert "synthetic" in e2e_path.name

    core = json.loads(core_path.read_text(encoding="utf-8"))
    e2e = json.loads(e2e_path.read_text(encoding="utf-8"))
    public = json.loads(public_path.read_text(encoding="utf-8"))
    assert core["synthetic"] is True
    assert e2e["synthetic"] is True
    if public.get("illustrative") is True:
        assert public.get("synthetic") is not True
        assert "block" in public
    else:
        assert public["status"] == "pending"
        assert "block" not in public

    e2e_ids = [v["id"] for v in e2e["block"]["variables"]]
    assert "TARIF" in e2e_ids and "CULT" in e2e_ids
    assert "prepared_matrix" not in e2e["block"]

    legacy = repo_root() / "app/public/meta/phase8_col_hs64.json"
    assert not legacy.exists()
