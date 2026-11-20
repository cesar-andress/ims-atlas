"""Transparency International CPI (CPIN): live XLSX download, or manual drop.

Verified 2026-11-20 with ``curl``: ``CPI2025_Results.xlsx`` answers HTTP 200
(~3 MB). ``CPI2024_Results.xlsx`` answered 403, so only the verified release is
listed; add a newer release here only after opening its URL.

The workbook uses the *strict* OOXML dialect (not readable by openpyxl); it is
parsed with ``xlsx_min``. The sheet ``CPI Timeseries <first> - <last>`` has one
row per country (header row: ``Country / Territory, ISO3, Region, CPI score
YYYY, Rank YYYY, ...``). Every ``CPI score YYYY`` column becomes ``(iso3, YYYY,
score)``; the CPI year is the ``year``.
The sibling sheet ``CPI Historical`` was cross-checked once (2026-11-20): identical
scores, plus three early-year rows (Puerto Rico 2012-2014) that the timeseries
sheet lacks; those three rows are not used.
"""

from __future__ import annotations

import re
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
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir

SOURCE_ID = "transparency_cpi"
SHEET_PATTERN = r"^CPI Timeseries"
SCORE_HEADER = re.compile(r"^CPI score (\d{4})$", re.IGNORECASE)


@dataclass(frozen=True)
class CpiRelease:
    year: int
    url: str


# Newest first. Only URLs opened in a verified session belong here.
RELEASES: tuple[CpiRelease, ...] = (
    CpiRelease(2025, "https://files.transparencycdn.org/images/CPI2025_Results.xlsx"),
)


def release_version(release: CpiRelease, last_modified: str | None) -> str:
    day = http_date_to_ymd(last_modified)
    return f"cpi{release.year}-{day.replace('-', '')}" if day else f"cpi{release.year}"


def probe_version(*, head: Header | None = None) -> dict[str, Any]:
    release = RELEASES[0]
    headers = (head or default_head)(release.url)
    modified = header_ci(headers, "Last-Modified")
    return {
        "upstream_version": release_version(release, modified),
        "upstream_changed_at": http_date_to_ymd(modified),
        "note": f"CPI {release.year} workbook Last-Modified (HEAD)",
    }


def live_version(*, root: Path | None = None, head: Header | None = None) -> str:
    if has_manual_drop(SOURCE_ID, root=root):
        return manual_drop.live_version(SOURCE_ID, root=root)
    return str(probe_version(head=head)["upstream_version"])


def parse_workbook(body: bytes) -> tuple[pd.DataFrame, dict[str, Any]]:
    """CPI score per (iso3, year) from the timeseries sheet; count discards."""
    try:
        book = Workbook(body)
        sheet = book.find_sheet(SHEET_PATTERN)
        rows = book.iter_rows(sheet)
        header: dict[str, str] | None = None
        iso_col = ""
        score_cols: dict[str, int] = {}
        counts = {
            "n_data_rows": 0,
            "n_non_country_rows": 0,
            "n_null_score": 0,
            "n_before_min_year": 0,
            "n_kept": 0,
        }
        records: list[dict[str, Any]] = []
        for _number, cells in rows:
            if header is None:
                labels = {col: str(v).strip() for col, v in cells.items()}
                if "ISO3" in labels.values() and any(
                    SCORE_HEADER.match(v) for v in labels.values()
                ):
                    header = labels
                    iso_col = next(c for c, v in labels.items() if v == "ISO3")
                    score_cols = {
                        col: int(m.group(1))
                        for col, v in labels.items()
                        if (m := SCORE_HEADER.match(v))
                    }
                continue
            counts["n_data_rows"] += 1
            iso3 = clean_iso3(cells.get(iso_col))
            if iso3 is None:
                counts["n_non_country_rows"] += 1
                continue
            for col, year in score_cols.items():
                if year < MIN_YEAR:
                    counts["n_before_min_year"] += 1
                    continue
                score = cells.get(col)
                if not isinstance(score, float):
                    counts["n_null_score"] += 1
                    continue
                records.append({"iso3": iso3, "year": year, "value": score})
    except XlsxError as exc:
        raise ValueError(f"{SOURCE_ID}: {exc}") from exc
    if header is None:
        raise ValueError(f"{SOURCE_ID}: header row with ISO3 and 'CPI score YYYY'")
    table = tidy_values(records, counts, label=SOURCE_ID)
    counts_out: dict[str, Any] = {**counts, "sheet": sheet}
    return table, counts_out


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
    release = RELEASES[0]
    body, headers = (fetch or default_fetch)(release.url)
    table, counts = parse_workbook(body)
    return write_raw(
        SOURCE_ID,
        version,
        root=root,
        table_name="values.csv",
        table=table,
        artifacts=[Artifact("source.xlsx", body, release.url, headers)],
        summary={
            "release_year": release.year,
            "year_semantics": "CPI year (score column label)",
            "parse": counts,
        },
        upstream_changed_at=http_date_to_ymd(header_ci(headers, "Last-Modified")),
        tidy_url=release.url,
    )
