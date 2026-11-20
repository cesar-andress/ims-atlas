"""KOF Globalisation Index — public XLSX from ETH Zurich.

Verified 2026-11-20: ``KOFGI_2025_public.xlsx`` answers HTTP 200 (~3.5 MB).
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

SOURCE_ID = "kof_globalisation"
RELEASE_URL = (
    "https://ethz.ch/content/dam/ethz/special-interest/dual/kof-dam/"
    "documents/Globalization/2025/KOFGI_2025_public.xlsx"
)
RELEASE_YEAR = 2025


def probe_version() -> dict[str, Any]:
    headers = head_headers(RELEASE_URL)
    modified = header_ci(headers, "Last-Modified")
    day = http_date_to_ymd(modified)
    if day:
        ver = f"kofgi{RELEASE_YEAR}-{day.replace('-', '')}"
    else:
        ver = f"kofgi{RELEASE_YEAR}"
    return {
        "upstream_version": ver,
        "upstream_changed_at": day,
        "note": f"KOFGI {RELEASE_YEAR} public XLSX Last-Modified (HEAD)",
    }


def parse_workbook(body: bytes) -> tuple[Any, dict[str, Any]]:

    try:
        book = Workbook(body)
        sheet = book.sheet_names[0]
        header: dict[str, str] | None = None
        iso_col = year_col = score_col = ""
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
                    if not iso_col and any(x in lab for x in ("iso3", "code", "iso")):
                        iso_col = col
                    if not year_col and lab == "year":
                        year_col = col
                    if not score_col and "kofgi" in lab and "rank" not in lab:
                        score_col = col
                if not score_col:
                    for col, lab in lower.items():
                        if col in {iso_col, year_col}:
                            continue
                        if lab and "rank" not in lab:
                            score_col = col
                            break
                if iso_col and year_col and score_col:
                    header = labels
                continue
            counts["n_data_rows"] += 1
            iso3 = clean_iso3(cells.get(iso_col))
            if iso3 is None:
                counts["n_non_country_rows"] += 1
                continue
            year_raw = cells.get(year_col)
            try:
                year = int(float(year_raw))  # type: ignore[arg-type]
            except (TypeError, ValueError):
                counts["n_non_country_rows"] += 1
                continue
            if year < MIN_YEAR:
                counts["n_before_min_year"] += 1
                continue
            score = cells.get(score_col)
            if not isinstance(score, (int, float)):
                counts["n_null_score"] += 1
                continue
            records.append({"iso3": iso3, "year": year, "value": float(score)})
    except XlsxError as exc:
        raise ValueError(f"{SOURCE_ID}: {exc}") from exc
    if header is None:
        raise ValueError(f"{SOURCE_ID}: could not locate iso/year/KOFGI columns")
    table = tidy_values(records, counts, label=SOURCE_ID)
    return table, {**counts, "sheet": sheet}


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    dest = raw_source_dir(SOURCE_ID, version, root=root) / "values.csv"
    if dest.is_file() and not force:
        return skipped(SOURCE_ID, version, dest)
    body, headers = fetch_bytes(RELEASE_URL, timeout=120.0)
    if not body.startswith(b"PK"):
        raise SourceUnavailableError(f"{SOURCE_ID}: response is not an XLSX")
    table, counts = parse_workbook(body)
    return write_raw(
        SOURCE_ID,
        version,
        root=root,
        table_name="values.csv",
        table=table,
        artifacts=[Artifact("KOFGI_public.xlsx", body, RELEASE_URL, headers)],
        summary={"release_year": RELEASE_YEAR, "parse": counts},
        upstream_changed_at=http_date_to_ymd(header_ci(headers, "Last-Modified")),
        tidy_url=RELEASE_URL,
    )
