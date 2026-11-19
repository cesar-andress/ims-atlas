"""Fail if app/public (or app/dist) embeds BYOD / non-redistributable values."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
import yaml

from imsatlas_etl.paths import repo_root

VALUE_KEY = re.compile(r'"([A-Z][A-Z0-9_]{1,31})"\s*:')


def _byod_or_non_redistributable_ids() -> set[str]:
    path = repo_root() / "catalog" / "variables.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    blocked: set[str] = set()
    for var in data["variables"]:
        if var.get("redistributable") is False or var.get("byod_only") is True:
            blocked.add(str(var["id"]))
    return blocked


def _scan_file(path: Path, blocked: set[str]) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    hits: list[str] = []
    for match in VALUE_KEY.finditer(text):
        key = match.group(1)
        if key not in blocked:
            continue
        after = text[match.end() : match.end() + 48].lstrip()
        # Allow string metadata / id lists: "TARIF" as a JSON string value elsewhere
        # is fine; value-map keys with numbers/null/objects are not.
        if after.startswith('"') or after.startswith("["):
            continue
        hits.append(f"{path.relative_to(repo_root())}: value key {key}")
    return hits


@pytest.mark.parametrize("subdir", ["app/public", "app/dist"])
def test_public_tree_has_no_byod_variable_values(subdir: str) -> None:
    root = repo_root() / subdir
    if not root.is_dir():
        pytest.skip(f"{subdir} not present")
    blocked = _byod_or_non_redistributable_ids()
    assert "TARIF" in blocked and "CULT" in blocked
    hits: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {
            ".json",
            ".js",
            ".css",
            ".html",
            ".map",
            ".txt",
            ".md",
            ".geojson",
        }:
            continue
        hits.extend(_scan_file(path, blocked))
    assert hits == [], "BYOD/non-redistributable values in public tree:\n" + "\n".join(
        hits,
    )


def test_phase8_public_fixture_excludes_tarif_cult() -> None:
    path = repo_root() / "app/public/meta/phase8_col_hs64.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    ids = [v["id"] for v in data["block"]["variables"]]
    assert "TARIF" not in ids and "CULT" not in ids
    for row in data["block"]["raw"]:
        assert "TARIF" not in row and "CULT" not in row
