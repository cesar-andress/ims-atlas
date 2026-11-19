"""Phase 12-fix: synthetic ranking fixtures must never ship under public/dist."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from imsatlas_etl.paths import repo_root

PADDED_ISO = re.compile(r'"X\d{2}"')
SYNTHETIC_TRUE = re.compile(r'"synthetic"\s*:\s*true', re.IGNORECASE)


def _scan_tree(root: Path) -> list[str]:
    hits: list[str] = []
    if not root.is_dir():
        return hits
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        name = path.name
        if name.startswith("phase8_col_hs64"):
            rel = path.relative_to(repo_root())
            hits.append(f"{rel}: legacy synthetic panel filename")
            continue
        if path.suffix.lower() not in {
            ".json",
            ".js",
            ".css",
            ".html",
            ".map",
            ".txt",
            ".md",
        }:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = str(path.relative_to(repo_root()))
        if SYNTHETIC_TRUE.search(text):
            hits.append(f"{rel}: synthetic:true")
        if PADDED_ISO.search(text):
            hits.append(f"{rel}: padded iso3 X##")
        if "build_col_hs64_block" in text:
            hits.append(f"{rel}: build_col_hs64_block marker")
        if path.suffix.lower() == ".json":
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            block = data.get("block") if isinstance(data, dict) else None
            if isinstance(block, dict) and "ranking_expert" in block and "raw" in block:
                if data.get("status") != "pending":
                    hits.append(f"{rel}: ranking block in product tree")
    return hits


@pytest.mark.parametrize("subdir", ["app/public", "app/dist"])
def test_public_tree_has_no_synthetic_demo_panel(subdir: str) -> None:
    root = repo_root() / subdir
    if not root.is_dir():
        pytest.skip(f"{subdir} not present")
    hits = _scan_tree(root)
    assert hits == [], "Synthetic demo leaked into product tree:\n" + "\n".join(hits)


def test_public_col_hs64_demo_is_pending() -> None:
    path = repo_root() / "app/public/meta/col_hs64_demo.json"
    assert path.is_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["status"] == "pending"
    assert "block" not in data
    assert data["origin"] == "COL"
    assert data["hs"] == "64"
    assert data["year"] == 2023
