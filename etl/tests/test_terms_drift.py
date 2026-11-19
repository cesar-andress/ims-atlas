from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from imsatlas_etl.pipeline.check import run_check
from imsatlas_etl.pipeline.terms import (
    annotate_terms_changed,
    compare_terms_hash,
    load_current_terms_sha,
    normalize_sha256,
    terms_changed_for_source,
    terms_snapshot_paths,
    write_terms_snapshot,
)
from imsatlas_etl.sources import SourcesValidationError

A = "a" * 64
B = "b" * 64


def _registry(sha: str | None) -> dict[str, dict]:
    return {
        "src": {
            "id": "src",
            "terms_url": "https://example.invalid/terms",
            "rights": {"evidence": {"snapshot_sha256": sha}},
        },
    }


def test_compare_pure() -> None:
    assert compare_terms_hash(A, B) is True
    assert compare_terms_hash(A, A) is False
    assert compare_terms_hash(A.upper(), A) is False
    assert compare_terms_hash(None, B) is None
    assert compare_terms_hash(A, None) is None
    assert compare_terms_hash("", B) is None
    assert compare_terms_hash("not-a-digest", B) is None


def test_normalize_sha256() -> None:
    assert normalize_sha256(f" {A.upper()} ") == A
    assert normalize_sha256(123) is None
    assert normalize_sha256("a" * 63) is None


def _write_snapshot(path: Path, sha: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"sha256": sha}), encoding="utf-8")


def test_load_current_prefers_status_then_manual(tmp_path: Path) -> None:
    status, manual = terms_snapshot_paths("src", root=tmp_path)
    assert load_current_terms_sha("src", root=tmp_path) is None
    _write_snapshot(manual, B)
    assert load_current_terms_sha("src", root=tmp_path) == B
    _write_snapshot(status, A)
    assert load_current_terms_sha("src", root=tmp_path) == A
    _write_snapshot(status, "garbage")
    assert load_current_terms_sha("src", root=tmp_path) == B


def test_annotate_sets_true_false_null(tmp_path: Path) -> None:
    rows = [{"source": "src", "stale": False}, {"source": "other"}]
    out = annotate_terms_changed(rows, registry=_registry(A), root=tmp_path)
    assert [r["terms_changed"] for r in out] == [None, None]
    _write_snapshot(terms_snapshot_paths("src", root=tmp_path)[0], B)
    out = annotate_terms_changed(rows, registry=_registry(A), root=tmp_path)
    assert out[0]["terms_changed"] is True and out[1]["terms_changed"] is None
    out = annotate_terms_changed(rows, registry=_registry(B), root=tmp_path)
    assert out[0]["terms_changed"] is False
    out = annotate_terms_changed(rows, registry=_registry(None), root=tmp_path)
    assert out[0]["terms_changed"] is None
    assert "terms_changed" not in rows[0]  # inputs are not mutated


def test_terms_changed_for_source_reads_evidence(tmp_path: Path) -> None:
    _write_snapshot(terms_snapshot_paths("src", root=tmp_path)[0], B)
    assert terms_changed_for_source(_registry(A)["src"], root=tmp_path) is True


def test_write_snapshot_uses_injected_fetch(tmp_path: Path) -> None:
    seen: list[str] = []

    def fetch(url: str) -> bytes:
        seen.append(url)
        return b"terms v2"

    path = write_terms_snapshot(
        "src",
        root=tmp_path,
        fetch=fetch,
        registry=_registry(A),
        now=datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC),
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert seen == ["https://example.invalid/terms"]
    assert payload["checked_at"] == "2026-01-02T03:04:05Z"
    assert payload["sha256"] == hashlib.sha256(b"terms v2").hexdigest()
    assert load_current_terms_sha("src", root=tmp_path) == payload["sha256"]
    with pytest.raises(SourcesValidationError):
        write_terms_snapshot("nope", root=tmp_path, registry=_registry(A))


def test_run_check_marks_terms_changed_without_network(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixture = Path(__file__).parent / "fixtures" / "mini_world"
    from imsatlas_etl.pipeline import check as check_mod

    monkeypatch.setattr(
        check_mod,
        "annotate_terms_changed",
        lambda rows, root=None: annotate_terms_changed(
            rows,
            registry=_registry(A) | {"baci": _registry(A)["src"] | {"id": "baci"}},
            root=root,
        ),
    )
    _write_snapshot(terms_snapshot_paths("baci", root=tmp_path)[0], B)
    rows = run_check(sources=["baci", "hofstede"], fixture_root=fixture, root=tmp_path)
    by = {r["source"]: r["terms_changed"] for r in rows}
    assert by == {"baci": True, "hofstede": None}
    saved = json.loads((tmp_path / "status" / "freshness.json").read_text("utf-8"))
    assert {r["source"]: r["terms_changed"] for r in saved["sources"]}["baci"] is True
