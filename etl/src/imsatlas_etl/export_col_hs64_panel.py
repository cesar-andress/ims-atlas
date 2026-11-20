"""Build a live COL · HS64 · 2023 ranking panel from curated tables (not synthetic)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from imsatlas_etl.paths import repo_root
from imsatlas_etl.pipeline.io_paths import curated_dir, internal_release_dir

ORIGIN = "COL"
HS = "64"
YEAR = 2023

WB_MAP = {
    "LPI": "LP.LPI.OVRL.XQ",
    "PLI": "PA.NUS.PRVT.PLI",
    "CO2PC": "EN.GHG.CO2.PC.CE.AR5",
    "INFL": "FP.CPI.TOTL.ZG",
    "UNEMP": "SL.UEM.TOTL.ZS",
    "EOC": "NE.TRD.GNFS.ZS",
    "CC": "CC.EST",
    "GE": "GE.EST",
    "RQ": "RQ.EST",
    "RL": "RL.EST",
    "PV": "PV.EST",
    "VA": "VA.EST",
}

PRODUCT_VARS = (
    ("IMPV", "benefit", "demand"),
    ("GRW", "benefit", "demand"),
    ("HHI", "cost", "competition"),
    ("ASIASH", "cost", "competition"),
    ("REEXP", "cost", "competition"),
    ("IMPC", "benefit", "demand"),
)


def _finite(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if np.isfinite(out) else None


def build_col_hs64_live_panel(*, root: Path | None = None) -> dict[str, Any]:
    cur = curated_dir(root=root)
    cy = pd.read_parquet(cur / "country_year.parquet")
    by = pd.read_parquet(cur / "bilateral_year.parquet")
    part = cur / "country_product_by_hs2" / f"hs2={HS}" / "part.parquet"
    if not part.is_file():
        raise FileNotFoundError(f"missing product partition {part}")
    cp = pd.read_parquet(part)
    cp = cp[(cp["year"] == YEAR) & (cp["hs_level"] == "hs2") & (cp["hs_code"] == HS)]
    wide = cp.pivot_table(
        index="iso3",
        columns="variable_id",
        values="value",
        aggfunc="first",
    )
    candidates = sorted(
        wide.index[wide["IMPV"].fillna(0) > 0].astype(str).unique().tolist(),
    )
    cy_y = cy[cy["year"] == YEAR].set_index("iso3")
    grav_year = int(by["year"].max()) if not by.empty else YEAR
    grav = by[(by["origin"] == ORIGIN) & (by["year"] == grav_year)].set_index(
        "destination",
    )

    variables: list[dict[str, str]] = [
        {"id": vid, "factor": factor, "direction": direction}
        for vid, direction, factor in PRODUCT_VARS
    ]
    for vid in WB_MAP:
        if vid in {"INFL", "UNEMP", "CO2PC"}:
            direction, factor = "cost", "macro_risk"
        elif vid == "LPI":
            direction, factor = "benefit", "logistics"
        elif vid == "PLI":
            direction, factor = "benefit", "cost_access"
        elif vid == "EOC":
            direction, factor = "benefit", "demand"
        else:
            direction, factor = "benefit", "macro_risk"
        variables.append({"id": vid, "factor": factor, "direction": direction})
    for vid, direction, factor in (
        ("DIST", "cost", "logistics"),
        ("LANG", "benefit", "institutional"),
        ("FTA", "benefit", "institutional"),
    ):
        variables.append({"id": vid, "factor": factor, "direction": direction})

    raw: list[dict[str, Any]] = []
    for iso in candidates:
        row: dict[str, Any] = {"iso3": iso}
        for vid, _, _ in PRODUCT_VARS:
            row[vid] = (
                _finite(wide.at[iso, vid])
                if iso in wide.index and vid in wide.columns
                else None
            )
        for vid, code in WB_MAP.items():
            row[vid] = (
                _finite(cy_y.at[iso, code])
                if iso in cy_y.index and code in cy_y.columns
                else None
            )
        if iso in grav.index:
            row["DIST"] = _finite(grav.at[iso, "distw"])
            row["LANG"] = _finite(grav.at[iso, "comlang_off"])
            row["FTA"] = _finite(grav.at[iso, "fta_wto"])
        else:
            row["DIST"] = row["LANG"] = row["FTA"] = None
        raw.append(row)

    key = ("IMPV", "LPI", "PLI", "DIST")
    kept = [r for r in raw if sum(1 for k in key if isinstance(r.get(k), float)) >= 3]
    kept.sort(key=lambda r: (-(r["IMPV"] or 0.0), str(r["iso3"])))
    candidates_out = [str(r["iso3"]) for r in kept]
    ranking = [
        {"iso3": str(r["iso3"]), "score": float(r["IMPV"] or 0.0), "rank": i + 1}
        for i, r in enumerate(kept)
    ]
    block = {
        "preset": "col_hs64_2023_live",
        "origin": ORIGIN,
        "hs": HS,
        "hs_name": "Footwear",
        "year": YEAR,
        "normalization": "ratio_legacy",
        "mcdm": "wsm",
        "weight_scheme": "equal",
        "missing_threshold": 0.4,
        "variables": variables,
        "candidates": candidates_out,
        "raw": kept,
        "ranking_expert": ranking[:50],
        "notes": [
            "Built from live curated World Bank + BACI HS64 + CEPII Gravity.",
            "EOC proxied by NE.TRD.GNFS.ZS until a dedicated openness series ships.",
            "ranking_expert follows IMPV order (not Jose workbook ranks).",
        ],
        "excluded_byod": [],
    }
    return {"synthetic": False, "block": block}


def write_col_hs64_live_panel(
    *,
    root: Path | None = None,
    version: str = "1.1.0",
) -> dict[str, Any]:
    payload = build_col_hs64_live_panel(root=root)
    base = root or repo_root()
    paths = [
        internal_release_dir(root=root)
        / f"v{version}"
        / "meta"
        / "col_hs64_panel.json",
        base / "data" / "store" / "cerrada" / "meta" / "col_hs64_panel.json",
        base / "status" / "meta" / "col_hs64_panel.json",
    ]
    written: list[str] = []
    body = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for path in paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
        written.append(str(path))
    return {
        "n_candidates": len(payload["block"]["candidates"]),
        "paths": written,
        "synthetic": False,
    }


def build_col_hs64_illustrative_panel(*, root: Path | None = None) -> dict[str, Any]:
    """Public visitor example: ship_raw/ship_derived cells only, labelled illustrative.

    Not a verified public release. Visitors see a ranking while draft variables
    wait for human `atlas-etl verify`. Team login still prefers the cerrada panel.
    """
    from imsatlas_etl.pipeline.release import SHIP_DECISIONS, _variable_gates

    payload = build_col_hs64_live_panel(root=root)
    ship_ids = {
        row["id"]
        for row in _variable_gates(audience="public")
        if row["decision"] in SHIP_DECISIONS
    }
    # Panel-only gravity columns map to ship_raw sources (DIST/LANG/FTA).
    ship_ids |= {"DIST", "LANG", "FTA", "CC", "GE", "RQ", "RL", "PV", "VA"}
    block = payload["block"]
    keep_vars = [v for v in block["variables"] if v["id"] in ship_ids]
    keep_ids = {v["id"] for v in keep_vars}
    raw = []
    for row in block["raw"]:
        slim = {"iso3": row["iso3"]}
        for vid in keep_ids:
            slim[vid] = row.get(vid)
        raw.append(slim)
    block = {
        **block,
        "preset": "col_hs64_2023_illustrative",
        "variables": keep_vars,
        "raw": raw,
        "notes": [
            "Illustrative public example from attested ship_raw/ship_derived sources.",
            "Not a verified public data release; the UI shows an illustrative band.",
            *list(block.get("notes") or []),
        ],
    }
    return {
        "synthetic": False,
        "illustrative": True,
        "block": block,
    }


def write_col_hs64_illustrative_public(
    *,
    root: Path | None = None,
    version: str = "1.1.0",
) -> dict[str, Any]:
    payload = build_col_hs64_illustrative_panel(root=root)
    base = root or repo_root()
    pub_meta = base / "data" / "release" / "public" / f"v{version}" / "meta"
    paths = [
        base / "app" / "public" / "meta" / "col_hs64_demo.json",
        pub_meta / "col_hs64_demo.json",
    ]
    written: list[str] = []
    body = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    for path in paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
        written.append(str(path))
    return {
        "n_candidates": len(payload["block"]["candidates"]),
        "n_variables": len(payload["block"]["variables"]),
        "paths": written,
        "illustrative": True,
        "synthetic": False,
    }
