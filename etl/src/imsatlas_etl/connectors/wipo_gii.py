"""WIPO Global Innovation Index (GII): live database download, or manual drop.

Verified 2026-11-20 with ``curl``: the publication pages
``https://www.wipo.int/publications/en/details.jsp?id=4807`` (GII 2025) and
``?id=4873`` (GII 2026) each list a "GII <year> Database" XLSX under
"Download data"; both XLSX files answer HTTP 200. Their ``Data`` sheet has one
row per economy and indicator (``ISO3, ECONOMY_NAME, NUM, NAME, DATAYR,
VALUE_SCREEN, SCORE, RANK, ...``); the overall index is the row whose ``NAME``
is ``Global Innovation Index`` (empty ``NUM``). ``year`` is the GII edition,
``value`` the overall score (0-100).

The WIPO "web-publications" copyright page answered 403 to ``curl``; the
licence is therefore not re-read here (rights stay in ``catalog/sources.yaml``).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors import manual_drop
from imsatlas_etl.connectors.http import header_ci, http_date_to_ymd
from imsatlas_etl.connectors.step3 import (
    Artifact,
    Fetcher,
    Header,
    clean_iso3,
    default_fetch,
    default_head,
    has_manual_drop,
    skipped,
    tidy_values,
    write_raw,
)
from imsatlas_etl.connectors.xlsx_min import Workbook, XlsxError
from imsatlas_etl.pipeline.io_paths import raw_source_dir

SOURCE_ID = "wipo_gii"
OVERALL_NAME = "Global Innovation Index"


@dataclass(frozen=True)
class GiiEdition:
    year: int
    url: str


# Newest first. Only URLs read from the publisher's page and opened with curl.
EDITIONS: tuple[GiiEdition, ...] = (
    GiiEdition(
        2026, "https://www.wipo.int/edocs/pubdocs/en/wipo-pub-2000-2026-tech1.xlsx"
    ),
    GiiEdition(
        2025, "https://www.wipo.int/edocs/pubdocs/en/wipo-pub-2000-2025-tech1.xlsx"
    ),
)


def probe_version(*, head: Header | None = None) -> dict[str, Any]:
    latest = EDITIONS[0]
    modified = header_ci((head or default_head)(latest.url), "Last-Modified")
    day = http_date_to_ymd(modified)
    suffix = f"-{day.replace('-', '')}" if day else ""
    return {
        "upstream_version": f"gii{latest.year}{suffix}",
        "upstream_changed_at": day,
        "note": f"GII {latest.year} database Last-Modified (HEAD)",
    }


def live_version(*, root: Path | None = None, head: Header | None = None) -> str:
    if has_manual_drop(SOURCE_ID, root=root):
        return manual_drop.live_version(SOURCE_ID, root=root)
    return str(probe_version(head=head)["upstream_version"])


def parse_edition(
    body: bytes, year: int
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Overall GII score per economy for one edition; count discards."""
    counts = {"n_data_rows": 0, "n_other_indicator": 0, "n_bad_iso3": 0, "n_null": 0}
    records: list[dict[str, Any]] = []
    try:
        book = Workbook(body)
        sheet = book.find_sheet(r"^Data$")
        cols: dict[str, str] | None = None
        for _n, cells in book.iter_rows(sheet):
            if cols is None:
                labels = {str(v).strip(): c for c, v in cells.items()}
                if {"ISO3", "NAME", "SCORE"} <= set(labels):
                    cols = {k: labels[k] for k in ("ISO3", "NAME", "SCORE")}
                continue
            counts["n_data_rows"] += 1
            if str(cells.get(cols["NAME"], "")).strip() != OVERALL_NAME:
                counts["n_other_indicator"] += 1
                continue
            iso3 = clean_iso3(cells.get(cols["ISO3"]))
            if iso3 is None:
                counts["n_bad_iso3"] += 1
                continue
            score = cells.get(cols["SCORE"])
            if not isinstance(score, float):
                counts["n_null"] += 1
                continue
            records.append({"iso3": iso3, "year": year, "value": score})
    except XlsxError as exc:
        raise ValueError(f"{SOURCE_ID} {year}: {exc}") from exc
    if cols is None:
        raise ValueError(f"{SOURCE_ID} {year}: Data sheet header (ISO3, NAME, SCORE)")
    return records, counts


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
    fetch: Fetcher | None = None,
) -> dict[str, Any]:
    if has_manual_drop(SOURCE_ID, root=root):
        return manual_drop.extract_live(SOURCE_ID, version, root=root, force=force)
    dest = raw_source_dir(SOURCE_ID, version, root=root) / "values.csv"
    if dest.is_file() and not force:
        return skipped(SOURCE_ID, version, dest)
    getter = fetch or default_fetch
    records: list[dict[str, Any]] = []
    artifacts: list[Artifact] = []
    per_edition: dict[str, dict[str, int]] = {}
    modified: str | None = None
    for edition in EDITIONS:
        body, headers = getter(edition.url)
        rows, counts = parse_edition(body, edition.year)
        records.extend(rows)
        per_edition[str(edition.year)] = counts
        artifacts.append(
            Artifact(f"gii{edition.year}.xlsx", body, edition.url, headers)
        )
        if modified is None:
            modified = http_date_to_ymd(header_ci(headers, "Last-Modified"))
    totals = {"n_kept": 0}
    table: pd.DataFrame = tidy_values(records, totals, label=SOURCE_ID)
    return write_raw(
        SOURCE_ID,
        version,
        root=root,
        table_name="values.csv",
        table=table,
        artifacts=artifacts,
        summary={
            "year_semantics": "GII edition year; overall score 0-100",
            "editions": [e.year for e in EDITIONS],
            "parse": per_edition,
        },
        upstream_changed_at=modified,
        tidy_url=EDITIONS[0].url,
    )
