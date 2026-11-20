"""Fragile States Index — Fund for Peace annual XLSX.

Verified 2026-11-20: latest stable download on the publisher site is
``FSI-2023-DOWNLOAD.xlsx`` (HTTP 200). Newer editions are added only after
their URL is opened successfully in a live session.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from imsatlas_etl.connectors.http import (
    SourceUnavailableError,
    fetch_bytes,
    head_headers,
    header_ci,
    http_date_to_ymd,
)
from imsatlas_etl.connectors.step3 import (
    Artifact,
    clean_iso3,
    skipped,
    tidy_values,
    write_raw,
)
from imsatlas_etl.connectors.xlsx_min import Workbook, XlsxError
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir

SOURCE_ID = "fragile_states_index"
RELEASES: tuple[tuple[int, str], ...] = (
    (
        2023,
        (
            "https://fragilestatesindex.org/wp-content/uploads/"
            "2023/06/FSI-2023-DOWNLOAD.xlsx"
        ),
    ),
)


def probe_version() -> dict[str, Any]:
    year, url = RELEASES[0]
    headers = head_headers(url)
    modified = header_ci(headers, "Last-Modified")
    day = http_date_to_ymd(modified)
    ver = f"fsi{year}-{day.replace('-', '')}" if day else f"fsi{year}"
    return {
        "upstream_version": ver,
        "upstream_changed_at": day,
        "note": f"FSI {year} workbook Last-Modified (HEAD)",
    }


def parse_workbook(body: bytes, edition_year: int) -> tuple[Any, dict[str, Any]]:
    try:
        book = Workbook(body)
        sheet = book.sheet_names[0]
        header: dict[str, str] | None = None
        iso_col = total_col = year_col = ""
        counts = {
            "n_data_rows": 0,
            "n_non_country_rows": 0,
            "n_null_score": 0,
            "n_before_min_year": 0,
            "n_kept": 0,
        }
        records: list[dict[str, Any]] = []
        for _number, cells in book.iter_rows(sheet):
            if header is None:
                labels = {col: str(v).strip() for col, v in cells.items()}
                lower = {col: lab.lower() for col, lab in labels.items()}
                for col, lab in lower.items():
                    if not iso_col and lab in {"iso3", "iso", "code"}:
                        iso_col = col
                    if not iso_col and ("iso3" in lab or lab.endswith("code")):
                        iso_col = col
                    if not total_col and lab in {"total", "fsi", "score"}:
                        total_col = col
                    if not total_col and "total" in lab:
                        total_col = col
                    if not year_col and lab == "year":
                        year_col = col
                if iso_col and total_col:
                    header = labels
                continue
            counts["n_data_rows"] += 1
            iso3 = clean_iso3(cells.get(iso_col))
            if iso3 is None:
                counts["n_non_country_rows"] += 1
                continue
            year = edition_year
            if year_col:
                raw_y = cells.get(year_col)
                try:
                    year = int(float(raw_y))  # type: ignore[arg-type]
                except (TypeError, ValueError):
                    year = edition_year
            if year < MIN_YEAR:
                counts["n_before_min_year"] += 1
                continue
            score = cells.get(total_col)
            if not isinstance(score, (int, float)):
                counts["n_null_score"] += 1
                continue
            records.append({"iso3": iso3, "year": year, "value": float(score)})
    except XlsxError as exc:
        raise ValueError(f"{SOURCE_ID}: {exc}") from exc
    if header is None:
        raise ValueError(f"{SOURCE_ID}: could not locate iso/total columns")
    table = tidy_values(records, counts, label=SOURCE_ID)
    return table, {**counts, "sheet": sheet, "edition_year": edition_year}


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    dest = raw_source_dir(SOURCE_ID, version, root=root) / "values.csv"
    if dest.is_file() and not force:
        return skipped(SOURCE_ID, version, dest)
    year, url = RELEASES[0]
    body, headers = fetch_bytes(url, timeout=90.0)
    if not body.startswith(b"PK"):
        raise SourceUnavailableError(f"{SOURCE_ID}: response is not an XLSX")
    table, counts = parse_workbook(body, year)
    return write_raw(
        SOURCE_ID,
        version,
        root=root,
        table_name="values.csv",
        table=table,
        artifacts=[Artifact("FSI_DOWNLOAD.xlsx", body, url, headers)],
        summary={"release_year": year, "parse": counts},
        upstream_changed_at=http_date_to_ymd(header_ci(headers, "Last-Modified")),
        tidy_url=url,
    )
