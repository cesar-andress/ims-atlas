"""Build curated variables_country_year from WB + Phase 3 index sources."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.connectors import country_index
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.pipeline.io_paths import curated_dir, freshness_path, raw_source_dir

# Variable id -> (source_id, raw column or 'value', kind)
# kind: wb_indicator uses indicator code in WDI long table; index uses values.csv
VARIABLE_SPECS: dict[str, dict[str, str]] = {
    "CO2PC": {
        "source_id": "worldbank_wdi",
        "kind": "wb_indicator",
        "code": "EN.GHG.CO2.PC.CE.AR5",
        "byod": "false",
    },
    "PLI": {
        "source_id": "worldbank_wdi",
        "kind": "wb_indicator",
        "code": "PA.NUS.PRVT.PLI",
        "byod": "false",
    },
    "ITU_IDI": {"source_id": "itu_datahub", "kind": "index", "byod": "true"},
    "EF_EPI": {"source_id": "ef_epi", "kind": "index", "byod": "true"},
    "ODIN": {"source_id": "odin", "kind": "index", "byod": "true"},
    "GEDI": {"source_id": "gedi", "kind": "index", "byod": "true"},
    "GII": {"source_id": "wipo_gii", "kind": "index", "byod": "true"},
    "STARTUPBLINK": {"source_id": "startupblink", "kind": "index", "byod": "true"},
    "EPI": {"source_id": "yale_epi", "kind": "index", "byod": "true"},
}


def _versions(*, root: Path | None) -> dict[str, str]:
    payload = json.loads(freshness_path(root=root).read_text(encoding="utf-8"))
    return {row["source"]: str(row["upstream_version"]) for row in payload["sources"]}


def _wb_series(
    code: str,
    source_id: str,
    version: str,
    *,
    root: Path | None,
) -> pd.DataFrame:
    path = raw_source_dir(source_id, version, root=root) / "indicators.csv"
    long = wb.load_raw_indicators(path)
    sub = long[long["indicator"] == code][["iso3", "year", "value"]].copy()
    return sub


def build_variables_country_year(
    *,
    root: Path | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    versions = _versions(root=root)
    meta: dict[str, Any] = {"variables": {}, "unmatched": {}}
    panels: list[pd.DataFrame] = []

    for vid, spec in VARIABLE_SPECS.items():
        source_id = spec["source_id"]
        if source_id not in versions:
            meta["variables"][vid] = {
                "status": "source_not_in_freshness",
                "source_id": source_id,
            }
            continue
        version = versions[source_id]
        if spec["kind"] == "wb_indicator":
            series = _wb_series(spec["code"], source_id, version, root=root)
            series = series.rename(columns={"value": vid})
            unmatched: list[dict[str, Any]] = []
        else:
            path = raw_source_dir(source_id, version, root=root) / "values.csv"
            series, unmatched = country_index.load_raw_values(path)
            series = series.rename(columns={"value": vid})
        meta["unmatched"][vid] = unmatched
        meta["variables"][vid] = {
            "status": "ok",
            "source_id": source_id,
            "version": version,
            "byod": spec["byod"] == "true",
            "n_rows": int(len(series)),
            "n_unmatched": len(unmatched),
            "years": sorted({int(y) for y in series["year"].dropna().unique()}),
            "countries": sorted({str(c) for c in series["iso3"].dropna().unique()}),
        }
        panels.append(series)

    if not panels:
        empty = pd.DataFrame(columns=["iso3", "year"])
        return empty, meta

    out = panels[0]
    for panel in panels[1:]:
        out = out.merge(panel, on=["iso3", "year"], how="outer")
    out = out.sort_values(["iso3", "year"]).reset_index(drop=True)
    return out, meta


def write_variables_country_year(*, root: Path | None = None) -> dict[str, Any]:
    frame, meta = build_variables_country_year(root=root)
    out_dir = curated_dir(root=root)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "variables_country_year.parquet"
    frame.to_parquet(path, index=False)
    meta_path = out_dir / "variables_country_year.meta.json"
    meta_path.write_text(
        json.dumps(meta, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return {
        "path": str(path),
        "rows": int(len(frame)),
        "columns": list(frame.columns),
        "meta": meta,
    }
