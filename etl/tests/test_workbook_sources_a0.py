"""Phase A0: every WORKBOOK_SOURCES.md URL is registered or explicitly ignored."""

from __future__ import annotations

import pytest

from imsatlas_etl.sources import assert_valid_sources, load_sources
from imsatlas_etl.workbook_sources import (
    KIND_VALUES,
    coverage_report,
    load_ignore_urls,
    parse_workbook_urls,
    workbook_sources_md_path,
)


def test_workbook_sources_md_present_for_local_dev() -> None:
    path = workbook_sources_md_path()
    if not path.is_file():
        pytest.skip("WORKBOOK_SOURCES.md not present (local-only file)")
    urls = parse_workbook_urls(path.read_text(encoding="utf-8"))
    assert len(urls) == 77


def test_every_workbook_url_covered_or_ignored() -> None:
    path = workbook_sources_md_path()
    if not path.is_file():
        pytest.skip("WORKBOOK_SOURCES.md not present (local-only file)")
    report = coverage_report()
    assert report["missing"] == [], report["missing"]
    assert report["sources_missing_kind"] == []
    assert report["ok"] is True
    assert report["workbook_url_count"] == 77
    assert len(report["ignored"]) == 7


def test_every_source_has_kind() -> None:
    data = load_sources()
    assert_valid_sources(data)
    for source in data["sources"]:
        assert source.get("kind") in KIND_VALUES, source["id"]


def test_ignore_list_has_reasons() -> None:
    ignore = load_ignore_urls()
    assert len(ignore) >= 7
    for url, reason in ignore.items():
        assert url.startswith("http")
        assert len(reason) > 10


def test_link_check_offline_writes_report(tmp_path, monkeypatch) -> None:
    from imsatlas_etl import link_check as lc

    monkeypatch.setattr(lc, "status_dir", lambda: tmp_path)
    monkeypatch.setattr(
        lc,
        "collect_urls_to_check",
        lambda: ["https://example.com/a", "https://example.com/b"],
    )
    report = lc.run_link_check(offline=True)
    assert report["n_checked"] == 2
    assert (tmp_path / "link_check.json").is_file()
