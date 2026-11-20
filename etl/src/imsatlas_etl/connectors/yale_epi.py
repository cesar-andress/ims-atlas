"""Yale Environmental Performance Index (EPI) — annual results XLSX.

Verified 2026-11-20: publisher hosts
``https://epi.yale.edu/sites/default/files/2026-09/epi2026results2026-07-07.xlsx``
(HTTP 200). Sheet ``data`` has ``iso``, ``country``, ``EPI.new`` (ISO3 already
present; no name mapping required).
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
from imsatlas_etl.pipeline.io_paths import raw_source_dir

SOURCE_ID = "yale_epi"
EDITION_YEAR = 2026
RELEASE_URL = (
    "https://epi.yale.edu/sites/default/files/2026-09/epi2026results2026-07-07.xlsx"
)
SCORE_COLUMNS = ("EPI.new", "EPI", "epi")


def probe_version() -> dict[str, Any]:
    headers = head_headers(RELEASE_URL)
    modified = header_ci(headers, "Last-Modified")
    day = http_date_to_ymd(modified)
    ver = f"epi{EDITION_YEAR}-{day.replace('-', '')}" if day else f"epi{EDITION_YEAR}"
    return {
        "upstream_version": ver,
        "upstream_changed_at": day,
        "note": f"Yale EPI {EDITION_YEAR} workbook Last-Modified (HEAD)",
    }


def parse_workbook(body: bytes, edition_year: int) -> tuple[Any, dict[str, Any]]:
    try:
        book = Workbook(body)
        sheet = "data" if "data" in book.sheet_names else book.sheet_names[0]
        header: dict[str, str] | None = None
        iso_col = score_col = ""
        counts = {
            "n_data_rows": 0,
            "n_bad_iso": 0,
            "n_null_score": 0,
            "n_kept": 0,
        }
        records: list[dict[str, Any]] = []
        for _number, cells in book.iter_rows(sheet):
            if header is None:
                labels = {col: str(v).strip() for col, v in cells.items()}
                lower = {col: lab.lower() for col, lab in labels.items()}
                for col, lab in lower.items():
                    if not iso_col and lab in {"iso", "iso3", "code"}:
                        iso_col = col
                    if not score_col and lab in {c.lower() for c in SCORE_COLUMNS}:
                        score_col = col
                if iso_col and score_col:
                    header = labels
                continue
            counts["n_data_rows"] += 1
            iso3 = clean_iso3(cells.get(iso_col))
            if iso3 is None:
                counts["n_bad_iso"] += 1
                continue
            score = cells.get(score_col)
            if not isinstance(score, (int, float)):
                counts["n_null_score"] += 1
                continue
            records.append({"iso3": iso3, "year": edition_year, "value": float(score)})
    except XlsxError as exc:
        raise ValueError(f"{SOURCE_ID}: {exc}") from exc
    if header is None:
        raise ValueError(f"{SOURCE_ID}: could not locate iso / EPI.new columns")
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
    body, headers = fetch_bytes(RELEASE_URL, timeout=90.0)
    if not body.startswith(b"PK"):
        raise SourceUnavailableError(f"{SOURCE_ID}: response is not an XLSX")
    table, counts = parse_workbook(body, EDITION_YEAR)
    return write_raw(
        SOURCE_ID,
        version,
        root=root,
        table_name="values.csv",
        table=table,
        artifacts=[Artifact("EPI_DOWNLOAD.xlsx", body, RELEASE_URL, headers)],
        summary={"release_year": EDITION_YEAR, "parse": counts},
        upstream_changed_at=http_date_to_ymd(header_ci(headers, "Last-Modified")),
        tidy_url=RELEASE_URL,
    )
