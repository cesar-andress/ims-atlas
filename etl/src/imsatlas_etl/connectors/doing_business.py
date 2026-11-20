"""World Bank Doing Business (archive): live databank bulk CSV, or manual drop.

Verified 2026-11-20 with ``curl``: the data-catalog page for dataset 0038564
links ``https://databank.worldbank.org/data/download/DB_CSV.zip``; the URL
redirects (301) to ``databankfiles.worldbank.org`` and answers HTTP 200
(~1.3 MB zip with ``DBData.csv``, ``DBCountry.csv``, ``DBSeries.csv``).
The World Bank API ``/v2/sources`` lists "Doing Business" (id 1, last updated
2021-08-18), but the one indicator request tried returned an API error, so the
bulk file is used instead.

Doing Business is discontinued. Only the headline "ease of doing business"
series are kept, each under its own indicator code because the methodology
changed (``IC.BUS.EASE.DFRN.DB1014``, ``...DB16``, ``...XQ.DB1719`` scores and
the ``IC.BUS.EASE.XQ`` rank); series are never spliced. Rows for subnational
cities (codes such as ``CHN_BEI``) and aggregates are dropped and counted.
``year`` is the column label published in ``DBData.csv``.
"""

from __future__ import annotations

import io
import zipfile
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
    write_raw,
)
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir

SOURCE_ID = "worldbank_doing_business"
ZIP_URL = "https://databank.worldbank.org/data/download/DB_CSV.zip"
INDICATOR_CODES: tuple[str, ...] = (
    "IC.BUS.EASE.DFRN.DB1014",
    "IC.BUS.EASE.DFRN.DB16",
    "IC.BUS.EASE.DFRN.XQ.DB1719",
    "IC.BUS.EASE.XQ",
)
TABLE_COLUMNS = ["iso3", "year", "indicator", "value"]


def probe_version(*, head: Header | None = None) -> dict[str, Any]:
    modified = header_ci((head or default_head)(ZIP_URL), "Last-Modified")
    day = http_date_to_ymd(modified)
    return {
        "upstream_version": f"db-{day.replace('-', '')}" if day else "db-unknown",
        "upstream_changed_at": day,
        "note": "DB_CSV.zip Last-Modified (HEAD); series discontinued",
    }


def live_version(*, root: Path | None = None, head: Header | None = None) -> str:
    if has_manual_drop(SOURCE_ID, root=root):
        return manual_drop.live_version(SOURCE_ID, root=root)
    return str(probe_version(head=head)["upstream_version"])


def parse_zip(body: bytes) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Long (iso3, year, indicator, value) table for the headline codes."""
    try:
        with zipfile.ZipFile(io.BytesIO(body)) as zf:
            data = pd.read_csv(io.BytesIO(zf.read("DBData.csv")), dtype=str)
            country = pd.read_csv(io.BytesIO(zf.read("DBCountry.csv")), dtype=str)
    except (zipfile.BadZipFile, KeyError) as exc:
        raise ValueError(f"{SOURCE_ID}: unexpected archive ({exc})") from exc
    for col in ("Country Code", "Indicator Code"):
        if col not in data.columns:
            raise ValueError(f"{SOURCE_ID}: DBData.csv lacks {col!r}")
    country.columns = [c.lstrip("\ufeff") for c in country.columns]
    economies = {
        str(r["Country Code"]).strip().upper()
        for _, r in country.iterrows()
        if str(r.get("Region") or "").strip() not in {"", "nan"}
    }
    year_cols = [c for c in data.columns if c.isdigit()]
    counts = {
        "n_input_rows": len(data),
        "n_other_indicator": 0,
        "n_not_economy": 0,
        "n_null_value": 0,
        "n_before_min_year": 0,
        "n_kept": 0,
    }
    records: list[dict[str, Any]] = []
    for row in data.to_dict("records"):
        code = str(row["Indicator Code"]).strip()
        if code not in INDICATOR_CODES:
            counts["n_other_indicator"] += 1
            continue
        iso3 = clean_iso3(row["Country Code"])
        if iso3 is None or iso3 not in economies:
            counts["n_not_economy"] += 1
            continue
        for col in year_cols:
            if int(col) < MIN_YEAR:
                counts["n_before_min_year"] += 1
                continue
            raw = row.get(col)
            if raw is None or str(raw).strip() in {"", "nan"}:
                counts["n_null_value"] += 1
                continue
            records.append(
                {
                    "iso3": iso3,
                    "year": int(col),
                    "indicator": code,
                    "value": float(raw),
                },
            )
    table = pd.DataFrame.from_records(records, columns=TABLE_COLUMNS)
    if table.empty:
        raise ValueError(f"{SOURCE_ID}: no usable rows (archive layout changed?)")
    dup = table.duplicated(["iso3", "year", "indicator"], keep=False)
    if dup.any():
        raise ValueError(
            f"{SOURCE_ID}: duplicate rows, e.g. {table[dup].head(3).to_dict('records')}"
        )
    counts["n_kept"] = len(table)
    table = table.sort_values(["indicator", "iso3", "year"]).reset_index(drop=True)
    return table, {**counts, "indicators": sorted(set(table["indicator"]))}


def extract_live(
    version: str,
    *,
    root: Path | None = None,
    force: bool = False,
    fetch: Fetcher | None = None,
) -> dict[str, Any]:
    if has_manual_drop(SOURCE_ID, root=root):
        return manual_drop.extract_live(SOURCE_ID, version, root=root, force=force)
    dest = raw_source_dir(SOURCE_ID, version, root=root) / "indicators.csv"
    if dest.is_file() and not force:
        return skipped(SOURCE_ID, version, dest)
    body, headers = (fetch or default_fetch)(ZIP_URL)
    table, counts = parse_zip(body)
    return write_raw(
        SOURCE_ID,
        version,
        root=root,
        table_name="indicators.csv",
        table=table,
        artifacts=[Artifact("DB_CSV.zip", body, ZIP_URL, headers)],
        summary={
            "year_semantics": "year column label in DBData.csv",
            "discontinued": True,
            "parse": counts,
        },
        upstream_changed_at=http_date_to_ymd(header_ci(headers, "Last-Modified")),
        tidy_url=ZIP_URL,
    )
