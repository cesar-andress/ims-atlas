"""Phase A0: WORKBOOK_SOURCES.md coverage against catalog/sources.yaml."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml

from imsatlas_etl.paths import catalog_dir, repo_root
from imsatlas_etl.sources import load_sources

KIND_VALUES = frozenset(
    {
        "official_api",
        "official_portal",
        "official_report_pdf",
        "secondary_aggregator",
        "commercial_quote_tool",
        "literature",
    },
)


def workbook_sources_md_path() -> Path:
    return repo_root() / "WORKBOOK_SOURCES.md"


def workbook_url_ignore_path() -> Path:
    return catalog_dir() / "workbook_url_ignore.yaml"


def parse_workbook_urls(md_text: str) -> list[str]:
    """Extract unique http(s) URLs from WORKBOOK_SOURCES.md tables."""
    found = re.findall(r"https?://[^\s|]+", md_text)
    # Preserve order, unique
    out: list[str] = []
    seen: set[str] = set()
    for u in found:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def load_ignore_urls(path: Path | None = None) -> dict[str, str]:
    target = path or workbook_url_ignore_path()
    data = yaml.safe_load(target.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("ignore"), list):
        raise ValueError(f"{target}: expected mapping with ignore: list")
    out: dict[str, str] = {}
    for row in data["ignore"]:
        if not isinstance(row, dict):
            continue
        url = row.get("url")
        reason = row.get("reason")
        if isinstance(url, str) and isinstance(reason, str):
            out[url] = reason
    return out


def cited_urls_from_sources(sources: dict[str, Any]) -> set[str]:
    urls: set[str] = set()
    for source in sources.get("sources", []):
        if not isinstance(source, dict):
            continue
        cited = source.get("cited_in_workbooks")
        if not isinstance(cited, list):
            continue
        for row in cited:
            if isinstance(row, dict) and isinstance(row.get("url"), str):
                urls.add(row["url"])
    return urls


def coverage_report(
    *,
    md_path: Path | None = None,
    sources: dict[str, Any] | None = None,
    ignore: dict[str, str] | None = None,
) -> dict[str, Any]:
    md = (md_path or workbook_sources_md_path()).read_text(encoding="utf-8")
    workbook_urls = parse_workbook_urls(md)
    ignore_map = ignore if ignore is not None else load_ignore_urls()
    registry = sources if sources is not None else load_sources()
    cited = cited_urls_from_sources(registry)

    missing: list[str] = []
    covered: list[str] = []
    ignored: list[dict[str, str]] = []
    for url in workbook_urls:
        if url in ignore_map:
            ignored.append({"url": url, "reason": ignore_map[url]})
        elif url in cited:
            covered.append(url)
        else:
            missing.append(url)

    sources_missing_kind = [
        s["id"]
        for s in registry.get("sources", [])
        if isinstance(s, dict) and s.get("kind") not in KIND_VALUES
    ]

    return {
        "workbook_url_count": len(workbook_urls),
        "covered": covered,
        "ignored": ignored,
        "missing": missing,
        "sources_missing_kind": sources_missing_kind,
        "ok": len(missing) == 0 and len(sources_missing_kind) == 0,
    }


def host_of(url: str) -> str | None:
    return urlparse(url).hostname
