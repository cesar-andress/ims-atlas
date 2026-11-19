from __future__ import annotations

import json
from pathlib import Path

from imsatlas_etl.export_phase5_goldens import default_output_path, write_phase5_goldens


def test_phase5_golden_fixture_exists_and_shaped() -> None:
    path = default_output_path()
    assert path.is_file(), "run: make export-phase5-goldens"
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["spec"] == "phase5"
    assert payload["tolerance"] == 1e-9
    assert len(payload["blocks"]) == 10
    block = payload["blocks"][0]
    assert "prepared" in block and "normalized" in block
    assert "weights" in block and "scores" in block
    assert len(block["candidates"]) >= 20


def test_phase5_golden_rebuild_stable(tmp_path: Path) -> None:
    out = tmp_path / "golden.json"
    write_phase5_goldens(out)
    a = json.loads(out.read_text(encoding="utf-8"))
    write_phase5_goldens(out)
    b = json.loads(out.read_text(encoding="utf-8"))
    assert a == b
