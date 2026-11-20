"""INFORM Risk Index (INRI): live pull of the HDX trends CSV, or manual drop.

The official Excel on the DRMKC site sits behind a survey form, so it is not
fetched. The same publisher (INFORM) distributes the overall index time series
on HDX; both URLs below were opened with ``curl`` on 2026-11-20 (HTTP 200,
the CSV via a 302 to object storage whose signed query string is never stored).

The HDX file ``inform_risk_index_trends.csv`` has columns
``CountryName, Iso3, GNAYear, IndicatorId, FullName, IndicatorScore`` with
``IndicatorId`` in ``INFORM`` (overall risk), ``HA``, ``VU``, ``CC``. Only
``INFORM`` is kept. The sibling ``inform_risk_index.csv`` (long indicator
table) has blank indicator names and no overall-risk row, so it is not used.

``year`` is ``GNAYear``, the INFORM edition year.
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors import manual_drop
from imsatlas_etl.connectors.http import SourceUnavailableError
from imsatlas_etl.connectors.step3 import (
    Artifact,
    Fetcher,
    clean_iso3,
    default_fetch,
    has_manual_drop,
    skipped,
    tidy_values,
    write_raw,
)
from imsatlas_etl.contracts.schemas import MIN_YEAR
from imsatlas_etl.pipeline.io_paths import raw_source_dir

SOURCE_ID = "inform_risk"
PACKAGE_URL = (
    "https://data.humdata.org/api/3/action/package_show"
    "?id=f5ec2ee7-8a1b-49b4-864b-70bdb582a022"
)
RESOURCE_ID = "b1d4a203-ef6e-44f7-9895-17c127aeaaee"
RESOURCE_URL = (
    "https://data.humdata.org/dataset/f5ec2ee7-8a1b-49b4-864b-70bdb582a022"
    f"/resource/{RESOURCE_ID}/download/inform_risk_index_trends.csv"
)
OVERALL_ID = "INFORM"
REQUIRED = {"Iso3", "GNAYear", "IndicatorId", "IndicatorScore"}


def parse_package(body: bytes) -> dict[str, Any]:
    """Locate the trends resource in a CKAN ``package_show`` response."""
    payload = json.loads(body.decode("utf-8"))
    if not payload.get("success"):
        raise SourceUnavailableError(f"{SOURCE_ID}: HDX package_show failed")
    for res in payload["result"].get("resources", []):
        if res.get("id") == RESOURCE_ID:
            return {
                "last_modified": res.get("last_modified"),
                "license_id": payload["result"].get("license_id"),
                "name": res.get("name"),
            }
    raise SourceUnavailableError(f"{SOURCE_ID}: trends resource not in HDX package")


def version_from_modified(last_modified: str | None) -> str:
    day = (last_modified or "")[:10].replace("-", "")
    if len(day) != 8 or not day.isdigit():
        raise SourceUnavailableError(f"{SOURCE_ID}: no usable HDX last_modified")
    return f"hdx-{day}"


def probe_version(*, fetch: Fetcher | None = None) -> dict[str, Any]:
    body, _headers = (fetch or default_fetch)(PACKAGE_URL)
    info = parse_package(body)
    return {
        "upstream_version": version_from_modified(info["last_modified"]),
        "upstream_changed_at": info["last_modified"],
        "note": f"HDX resource last_modified; licence tag {info['license_id']}",
    }


def live_version(*, root: Path | None = None, fetch: Fetcher | None = None) -> str:
    if has_manual_drop(SOURCE_ID, root=root):
        return manual_drop.live_version(SOURCE_ID, root=root)
    return str(probe_version(fetch=fetch)["upstream_version"])


def parse_trends(body: bytes) -> tuple[pd.DataFrame, dict[str, int]]:
    """Overall INFORM Risk score per (iso3, year); count every discarded row."""
    raw = pd.read_csv(io.BytesIO(body), dtype={"Iso3": str, "IndicatorId": str})
    missing = REQUIRED - set(raw.columns)
    if missing:
        raise ValueError(f"{SOURCE_ID}: missing columns {sorted(missing)}")
    counts = {
        "n_input_rows": len(raw),
        "n_other_indicator": 0,
        "n_bad_iso3": 0,
        "n_bad_year": 0,
        "n_before_min_year": 0,
        "n_null_value": 0,
        "n_kept": 0,
    }
    records: list[dict[str, Any]] = []
    for row in raw.itertuples(index=False):
        if str(row.IndicatorId).strip() != OVERALL_ID:
            counts["n_other_indicator"] += 1
            continue
        iso3 = clean_iso3(row.Iso3)
        if iso3 is None:
            counts["n_bad_iso3"] += 1
            continue
        try:
            year = int(row.GNAYear)
        except (TypeError, ValueError):
            counts["n_bad_year"] += 1
            continue
        if year < MIN_YEAR:
            counts["n_before_min_year"] += 1
            continue
        if pd.isna(row.IndicatorScore):
            counts["n_null_value"] += 1
            continue
        records.append({"iso3": iso3, "year": year, "value": float(row.IndicatorScore)})
    return tidy_values(records, counts, label=SOURCE_ID), counts


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
    pkg_body, _ = getter(PACKAGE_URL)
    info = parse_package(pkg_body)
    body, headers = getter(RESOURCE_URL)
    table, counts = parse_trends(body)
    return write_raw(
        SOURCE_ID,
        version,
        root=root,
        table_name="values.csv",
        table=table,
        artifacts=[
            Artifact("inform_risk_index_trends.csv", body, RESOURCE_URL, headers),
        ],
        summary={
            "indicator_id_kept": OVERALL_ID,
            "year_semantics": "GNAYear (INFORM edition year)",
            "hdx_last_modified": info["last_modified"],
            "hdx_license_id": info["license_id"],
            "discards": counts,
        },
        upstream_changed_at=info["last_modified"],
        tidy_url=RESOURCE_URL,
    )
