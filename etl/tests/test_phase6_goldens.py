from __future__ import annotations

import json
from pathlib import Path

from imsatlas_etl.export_phase6_goldens import default_output_path, write_phase6_goldens


def test_phase6_golden_fixture_shaped() -> None:
    path = default_output_path()
    assert path.is_file(), "run: make export-phase6-goldens"
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["spec"] == "phase6"
    assert len(payload["metrics"]) >= 8
    assert len(payload["splits"]) == 2
    assert payload["smaa"]["n_alt"] == 60
    assert payload["smaa"]["n_samples"] == 2000


def test_phase6_golden_rebuild_stable(tmp_path: Path) -> None:
    out = tmp_path / "golden.json"
    write_phase6_goldens(out)
    a = json.loads(out.read_text(encoding="utf-8"))
    write_phase6_goldens(out)
    b = json.loads(out.read_text(encoding="utf-8"))
    assert a == b
