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


@pytest.mark.parametrize("subdir", ["app/public", "app/dist"])
def test_public_tree_has_no_cerrada_store_payloads(subdir: str) -> None:
    """ABIERTO static build must never ship cerrada store artefacts."""
    root = repo_root() / subdir
    if not root.is_dir():
        pytest.skip(f"{subdir} not present")
    # Path strings for /datos-cerrados/whoami.json are public config; forbid
    # embedding the on-disk cerrada store layout or its parquet payloads.
    forbidden = ("data/store/cerrada", "store/cerrada/country_year")
    hits: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if "store/cerrada" in path.as_posix():
            hits.append(f"{path.relative_to(repo_root())}: path under store/cerrada")
            continue
        if path.suffix.lower() not in {".json", ".js", ".html", ".map", ".txt", ".md"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for needle in forbidden:
            if needle in text:
                hits.append(f"{path.relative_to(repo_root())}: {needle}")
    assert hits == [], "cerrada store payload in ABIERTO tree:\n" + "\n".join(hits)


def test_public_col_hs64_demo_has_no_byod_raw_block() -> None:
    """Public demo (pending or illustrative) must not embed BYOD raw value keys."""
    path = repo_root() / "app/public/meta/col_hs64_demo.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("status") == "pending":
        assert "block" not in data
    else:
        assert data.get("illustrative") is True
        assert "block" in data
    text = path.read_text(encoding="utf-8")
    assert '"TARIF"' not in text and '"CULT"' not in text
