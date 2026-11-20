"""rights-set dry-run must not mutate sources.yaml."""

from __future__ import annotations

from pathlib import Path

import yaml

from imsatlas_etl.rights import rights_set


def test_rights_set_dry_run_does_not_write(tmp_path: Path, monkeypatch) -> None:
    root = Path(__file__).resolve().parents[2]
    src = root / "catalog" / "sources.yaml"
    data = yaml.safe_load(src.read_text(encoding="utf-8"))
    target = next(s for s in data["sources"] if s["id"] == "gedi")
    before = target["rights"]["use_research"]

    # Point paths at a copy so a bug that writes still cannot spoil the real catalog.
    copy = tmp_path / "sources.yaml"
    copy.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setattr(
        "imsatlas_etl.rights.sources_yaml_path",
        lambda: copy,
    )

    preview = rights_set(
        "gedi",
        by="CA",
        use_research="yes",
        note="dry-run test note",
        basis="public_terms",
        dry_run=True,
    )
    assert preview["dry_run"] is True
    assert preview["use_research_before"] == before
    assert preview["use_research_after"] == "yes"

    after = yaml.safe_load(copy.read_text(encoding="utf-8"))
    gedi = next(s for s in after["sources"] if s["id"] == "gedi")
    assert gedi["rights"]["use_research"] == before
