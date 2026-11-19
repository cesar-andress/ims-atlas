"""Phase A0: HTTP link check for workbook / source cited URLs."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from imsatlas_etl.paths import repo_root, status_dir
from imsatlas_etl.sources import load_sources
from imsatlas_etl.workbook_sources import load_ignore_urls, parse_workbook_urls


def _probe(url: str, *, timeout: float = 20.0) -> dict[str, Any]:
    req = Request(
        url,
        headers={
            "User-Agent": "ims-atlas-etl/0.1 (+https://atlas.aiserv.es; link-check)",
            "Accept": "*/*",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310
            final = resp.geturl()
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return {
                "url": url,
                "status": int(resp.status),
                "final_url": final,
                "redirected": final.rstrip("/") != url.rstrip("/"),
                "last_modified": headers.get("last-modified"),
                "error": None,
            }
    except HTTPError as exc:
        return {
            "url": url,
            "status": int(exc.code),
            "final_url": exc.url if hasattr(exc, "url") else url,
            "redirected": False,
            "last_modified": None,
            "error": str(exc.reason),
        }
    except (URLError, TimeoutError, ValueError) as exc:
        return {
            "url": url,
            "status": None,
            "final_url": None,
            "redirected": False,
            "last_modified": None,
            "error": str(exc),
        }


def collect_urls_to_check() -> list[str]:
    """Workbook URLs minus ignore list, plus each source landing_url."""
    root = repo_root()
    md = root / "WORKBOOK_SOURCES.md"
    urls: list[str] = []
    if md.is_file():
        ignore = set(load_ignore_urls().keys())
        for u in parse_workbook_urls(md.read_text(encoding="utf-8")):
            if u not in ignore:
                urls.append(u)
    for source in load_sources()["sources"]:
        lu = source.get("landing_url")
        if isinstance(lu, str) and lu not in urls:
            urls.append(lu)
    return urls


def run_link_check(
    *,
    offline: bool = False,
    urls: list[str] | None = None,
) -> dict[str, Any]:
    targets = urls if urls is not None else collect_urls_to_check()
    rows: list[dict[str, Any]] = []
    if offline:
        for u in targets:
            rows.append(
                {
                    "url": u,
                    "status": None,
                    "final_url": None,
                    "redirected": False,
                    "last_modified": None,
                    "error": "offline",
                },
            )
    else:
        for u in targets:
            rows.append(_probe(u))

    dead = [
        r
        for r in rows
        if r.get("error")
        or (isinstance(r.get("status"), int) and int(r["status"]) >= 400)
    ]
    report = {
        "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "n_checked": len(rows),
        "n_dead_or_error": len(dead),
        "offline": offline,
        "rows": rows,
        "dead": dead,
    }
    out = status_dir() / "link_check.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    out.write_text(payload, encoding="utf-8")
    return report
