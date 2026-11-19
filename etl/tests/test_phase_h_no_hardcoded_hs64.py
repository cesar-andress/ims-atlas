"""Phase H: production app code must not silently default to HS 64."""

from __future__ import annotations

import re
from pathlib import Path

from imsatlas_etl.paths import repo_root

APP_SRC = repo_root() / "app" / "src"

FALLBACK_HS64 = re.compile(r'\?\?\s*"64"')
INLINE_HS64 = re.compile(r'hs:\s*"64"')

ALLOWED_REL: set[str] = {
    "state/schema.ts",
}

ALLOWED_SUFFIXES = (
    ".test.ts",
    ".test.tsx",
    ".spec.ts",
)


def _is_allowed(path: Path) -> bool:
    rel = path.relative_to(APP_SRC).as_posix()
    if rel in ALLOWED_REL:
        return True
    name = path.name
    if name.endswith(ALLOWED_SUFFIXES):
        return True
    return False


def _scan_file(path: Path) -> list[str]:
    if _is_allowed(path):
        return []
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(repo_root()).as_posix()
    hits: list[str] = []
    for i, line in enumerate(text.splitlines(), start=1):
        if FALLBACK_HS64.search(line):
            hits.append(f'{rel}:{i}: ?? "64"')
        if INLINE_HS64.search(line):
            hits.append(f'{rel}:{i}: hs: "64"')
    return hits


def test_app_src_has_no_hardcoded_hs64_defaults() -> None:
    all_hits: list[str] = []
    for path in sorted(APP_SRC.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".ts", ".tsx"}:
            continue
        all_hits.extend(_scan_file(path))
    msg = "Hard-coded HS64 fallbacks in app/src:\n" + "\n".join(all_hits)
    assert all_hits == [], msg
