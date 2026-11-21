"""Build curated ``variables_country_year`` (wide) from catalog codes + raw extracts.

Maps every country-level catalog variable that has raw data onto a column named
with the catalog id (LPI, PLI, CC, …). Release melt + the browser panel consume
these ids — never WB indicator codes as panel variable ids.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.connectors import country_index
from imsatlas_etl.connectors import worldbank as wb
from imsatlas_etl.pipeline.io_paths import curated_dir, freshness_path, raw_source_dir

# Explicit World Bank indicator → catalog id (covers WDI / WGI / LPI).
# Prefer canonical IMSFE ids (LPI/PLI/INFL/UNEMP); aliases LPIN/CLI/INAN/UNRA
# share the same series and are not duplicated here.
WB_CODE_TO_VAR: dict[str, tuple[str, str]] = {
    # code → (variable_id, source_id)
    "LP.LPI.OVRL.XQ": ("LPI", "worldbank_lpi"),
    "PA.NUS.PRVT.PLI": ("PLI", "worldbank_wdi"),
    "NY.GDP.PCAP.PP.KD": ("GDPPC", "worldbank_wdi"),
    "EN.GHG.CO2.PC.CE.AR5": ("CO2PC", "worldbank_wdi"),
    "FP.CPI.TOTL.ZG": ("INFL", "worldbank_wdi"),
    "SL.UEM.TOTL.ZS": ("UNEMP", "worldbank_wdi"),
    "NE.TRD.GNFS.ZS": ("EOC", "worldbank_wdi"),
    "IC.IMP.CSBC.CD": ("CIBC", "worldbank_wdi"),
    "IS.SHP.GOOD.TU": ("CPTR", "worldbank_wdi"),
    "CC.EST": ("CC", "worldbank_wgi"),
    "GE.EST": ("GE", "worldbank_wgi"),
    "RQ.EST": ("RQ", "worldbank_wgi"),
    "RL.EST": ("RL", "worldbank_wgi"),
    "PV.EST": ("PV", "worldbank_wgi"),
    "VA.EST": ("VA", "worldbank_wgi"),
}

# Back-compat alias used by provenance / phase3 reports.
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
    "GDPPC": {
        "source_id": "worldbank_wdi",
        "kind": "wb_indicator",
        "code": "NY.GDP.PCAP.PP.KD",
        "byod": "false",
    },
    "LPI": {
        "source_id": "worldbank_lpi",
        "kind": "wb_indicator",
        "code": "LP.LPI.OVRL.XQ",
        "byod": "false",
    },
    "INFL": {
        "source_id": "worldbank_wdi",
        "kind": "wb_indicator",
        "code": "FP.CPI.TOTL.ZG",
        "byod": "false",
    },
    "UNEMP": {
        "source_id": "worldbank_wdi",
        "kind": "wb_indicator",
        "code": "SL.UEM.TOTL.ZS",
        "byod": "false",
    },
    "EOC": {
        "source_id": "worldbank_wdi",
        "kind": "wb_indicator",
        "code": "NE.TRD.GNFS.ZS",
        "byod": "false",
    },
    "CIBC": {
        "source_id": "worldbank_wdi",
        "kind": "wb_indicator",
        "code": "IC.IMP.CSBC.CD",
        "byod": "true",
    },
    "CPTR": {
        "source_id": "worldbank_wdi",
        "kind": "wb_indicator",
        "code": "IS.SHP.GOOD.TU",
        "byod": "true",
    },
    "CC": {
        "source_id": "worldbank_wgi",
        "kind": "wb_indicator",
        "code": "CC.EST",
        "byod": "false",
    },
    "GE": {
        "source_id": "worldbank_wgi",
        "kind": "wb_indicator",
        "code": "GE.EST",
        "byod": "false",
    },
    "RQ": {
        "source_id": "worldbank_wgi",
        "kind": "wb_indicator",
        "code": "RQ.EST",
        "byod": "false",
    },
    "RL": {
        "source_id": "worldbank_wgi",
        "kind": "wb_indicator",
        "code": "RL.EST",
        "byod": "false",
    },
    "PV": {
        "source_id": "worldbank_wgi",
        "kind": "wb_indicator",
        "code": "PV.EST",
        "byod": "false",
    },
    "VA": {
        "source_id": "worldbank_wgi",
        "kind": "wb_indicator",
        "code": "VA.EST",
        "byod": "false",
    },
    "GOV": {
        "source_id": "worldbank_wgi",
        "kind": "derived_mean",
        "byod": "false",
    },
    "EPI": {"source_id": "yale_epi", "kind": "index", "byod": "true"},
    "INRI": {"source_id": "inform_risk", "kind": "index", "byod": "true"},
    "CPIN": {"source_id": "transparency_cpi", "kind": "index", "byod": "true"},
    "GII": {"source_id": "wipo_gii", "kind": "index", "byod": "true"},
    "FSIN": {"source_id": "fragile_states_index", "kind": "index", "byod": "true"},
    "GLIN": {"source_id": "kof_globalisation", "kind": "index", "byod": "true"},
    "ITU_IDI": {"source_id": "itu_datahub", "kind": "index", "byod": "true"},
    "EF_EPI": {"source_id": "ef_epi", "kind": "index", "byod": "true"},
    "ODIN": {"source_id": "odin", "kind": "index", "byod": "true"},
    "GEDI": {"source_id": "gedi", "kind": "index", "byod": "true"},
    "STARTUPBLINK": {"source_id": "startupblink", "kind": "index", "byod": "true"},
}

# Index / values.csv sources → catalog variable id.
INDEX_SPECS: dict[str, dict[str, str]] = {
    "EPI": {"source_id": "yale_epi"},
    "INRI": {"source_id": "inform_risk"},
    "CPIN": {"source_id": "transparency_cpi"},
    "GII": {"source_id": "wipo_gii"},
    "FSIN": {"source_id": "fragile_states_index"},
    "GLIN": {"source_id": "kof_globalisation"},
    # Phase-3 BYOD placeholders (included when fixture/raw exists).
    "ITU_IDI": {"source_id": "itu_datahub"},
    "EF_EPI": {"source_id": "ef_epi"},
    "ODIN": {"source_id": "odin"},
    "GEDI": {"source_id": "gedi"},
    "STARTUPBLINK": {"source_id": "startupblink"},
}

# Never surface these until César confirms use_research (Prompt 4a gate).
BLOCKED_SOURCE_IDS = frozenset({"ecb_fx", "vat_rates"})

WGI_PARTS = ("CC", "GE", "RQ", "RL", "PV", "VA")


def _versions(*, root: Path | None) -> dict[str, str]:
    payload = json.loads(freshness_path(root=root).read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for row in payload.get("sources", []):
        sid = str(row.get("source") or "")
        ver = row.get("ingested_version") or row.get("upstream_version")
        if not sid or ver is None:
            continue
        ver_s = str(ver).strip()
        if not ver_s or ver_s.lower() == "none":
            continue
        out[sid] = ver_s
    return out


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


def _append_panel(
    panels: list[pd.DataFrame],
    series: pd.DataFrame,
    vid: str,
) -> None:
    if series.empty:
        return
    chunk = series.rename(columns={"value": vid})[["iso3", "year", vid]].copy()
    panels.append(chunk)


def build_variables_country_year(
    *,
    root: Path | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    versions = _versions(root=root)
    meta: dict[str, Any] = {
        "variables": {},
        "unmatched": {},
        "blocked_sources": sorted(BLOCKED_SOURCE_IDS),
    }
    panels: list[pd.DataFrame] = []

    # Prefer catalog codes when present; fall back to WB_CODE_TO_VAR.
    # Fixture worlds may omit catalog/ under ATLAS_ROOT — then skip status tags.
    try:
        catalog_vars = {
            str(v["id"]): v
            for v in (load_catalog().get("variables") or [])
            if v.get("id")
        }
    except (FileNotFoundError, OSError):
        catalog_vars = {}

    for code, (vid, source_id) in WB_CODE_TO_VAR.items():
        if source_id in BLOCKED_SOURCE_IDS:
            continue
        if source_id not in versions:
            meta["variables"][vid] = {
                "status": "source_not_in_freshness",
                "source_id": source_id,
            }
            continue
        version = versions[source_id]
        try:
            path = raw_source_dir(source_id, version, root=root) / "indicators.csv"
            if not path.is_file():
                raise FileNotFoundError(str(path))
            series = _wb_series(code, source_id, version, root=root)
            if series.empty:
                raise ValueError(f"no rows for {code}")
        except (FileNotFoundError, ValueError, OSError) as exc:
            meta["variables"][vid] = {
                "status": "raw_missing",
                "source_id": source_id,
                "version": version,
                "reason": str(exc),
            }
            continue
        _append_panel(panels, series, vid)
        meta["variables"][vid] = {
            "status": "ok",
            "source_id": source_id,
            "version": version,
            "code": code,
            "n_rows": int(len(series)),
            "years": sorted({int(y) for y in series["year"].dropna().unique()}),
            "catalog_status": (catalog_vars.get(vid) or {}).get("status"),
        }

    for vid, spec in INDEX_SPECS.items():
        source_id = spec["source_id"]
        if source_id in BLOCKED_SOURCE_IDS:
            meta["variables"][vid] = {
                "status": "blocked_pending_rights",
                "source_id": source_id,
            }
            continue
        if source_id not in versions:
            meta["variables"][vid] = {
                "status": "source_not_in_freshness",
                "source_id": source_id,
            }
            continue
        version = versions[source_id]
        try:
            path = raw_source_dir(source_id, version, root=root) / "values.csv"
            if not path.is_file():
                raise FileNotFoundError(str(path))
            series, unmatched = country_index.load_raw_values(path)
        except (FileNotFoundError, ValueError, OSError) as exc:
            meta["variables"][vid] = {
                "status": "raw_missing",
                "source_id": source_id,
                "version": version,
                "reason": str(exc),
            }
            continue
        meta["unmatched"][vid] = unmatched
        _append_panel(panels, series, vid)
        meta["variables"][vid] = {
            "status": "ok",
            "source_id": source_id,
            "version": version,
            "n_rows": int(len(series)),
            "n_unmatched": len(unmatched),
            "years": sorted({int(y) for y in series["year"].dropna().unique()}),
            "catalog_status": (catalog_vars.get(vid) or {}).get("status"),
        }

    if not panels:
        empty = pd.DataFrame(columns=["iso3", "year"])
        return empty, meta

    out = panels[0]
    for panel in panels[1:]:
        out = out.merge(panel, on=["iso3", "year"], how="outer")

    # GOV = mean of the six WGI estimate series (catalog definition).
    present = [c for c in WGI_PARTS if c in out.columns]
    if present:
        out["GOV"] = out[present].mean(axis=1, skipna=True)
        wgi_version = versions.get("worldbank_wgi")
        meta["variables"]["GOV"] = {
            "status": "ok",
            "source_id": "worldbank_wgi",
            "version": wgi_version,
            "derived_from": present,
            "n_rows": int(out["GOV"].notna().sum()),
            "catalog_status": (catalog_vars.get("GOV") or {}).get("status"),
        }

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
