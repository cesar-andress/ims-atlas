#!/usr/bin/env python3
"""Measure Prompt 4a panel for ESP · café (HS 0901) · 2024 against a release."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pandas as pd

ORIGIN, HS, YEAR = "ESP", "0901", 2024
LOCF = 5
PRODUCT = ["IMPV", "IMPC", "GRW", "HHI", "ASIASH", "REEXP", "UVGAP", "PPAD"]
BILAT = ["DIST", "LANG", "FTA"]
BLOCKED = {"ecb_fx", "vat_rates"}


def main() -> None:
    root = Path(os.environ.get("ATLAS_ROOT", Path(__file__).resolve().parents[1]))
    current = (root / "data/release/internal/CURRENT").read_text(encoding="utf-8").strip()
    rel = root / "data/release/internal" / current
    t0 = time.perf_counter()

    hs2, hs_level, hs_code = "09", "hs4", "0901"
    cp_path = rel / "country_product" / f"hs2={hs2}" / "part.parquet"
    cp = pd.read_parquet(cp_path)
    cp = cp[
        (cp.hs_level == hs_level)
        & (cp.hs_code.astype(str) == hs_code)
        & (cp.year <= YEAR)
        & (cp.year >= YEAR - LOCF)
        & (cp.variable_id.isin(PRODUCT))
    ]
    best: dict[tuple[str, str], tuple[int, float]] = {}
    for row in cp.itertuples(index=False):
        key = (str(row.iso3), str(row.variable_id))
        year = int(row.year)
        value = float(row.value)
        prev = best.get(key)
        if prev is None or year > prev[0]:
            best[key] = (year, value)
    cands = sorted(
        {
            iso
            for (iso, vid), (_y, value) in best.items()
            if vid == "IMPV" and value > 0
        },
    )

    catalog = json.loads((rel / "catalog.json").read_text(encoding="utf-8"))
    vars_meta = {v["id"]: v for v in catalog.get("variables", [])}
    country_wanted: list[str] = []
    for vid, meta in vars_meta.items():
        sources = meta.get("source_ids") or []
        if vid in PRODUCT or vid in BILAT:
            continue
        if any(source in BLOCKED for source in sources):
            continue
        country_wanted.append(vid)
    for extra in (
        "LPI",
        "PLI",
        "GDPPC",
        "CO2PC",
        "INFL",
        "UNEMP",
        "EOC",
        "CIBC",
        "CPTR",
        "GOV",
        "CC",
        "GE",
        "RQ",
        "RL",
        "PV",
        "VA",
        "EPI",
        "INRI",
        "CPIN",
        "GII",
        "FSIN",
        "GLIN",
    ):
        if extra not in country_wanted and extra in vars_meta:
            country_wanted.append(extra)

    cy = pd.read_parquet(rel / "country_year.parquet")
    cy = cy[
        (cy.year <= YEAR)
        & (cy.year >= YEAR - LOCF)
        & (cy.variable_id.isin(country_wanted))
        & (cy.iso3.isin(cands))
    ]
    cbest: dict[tuple[str, str], tuple[int, float]] = {}
    for row in cy.itertuples(index=False):
        if pd.isna(row.value):
            continue
        key = (str(row.iso3), str(row.variable_id))
        year = int(row.year)
        prev = cbest.get(key)
        if prev is None or year > prev[0]:
            cbest[key] = (year, float(row.value))

    bil = pd.read_parquet(rel / "bilateral_year.parquet")
    bil = bil[
        (bil.iso3_o == ORIGIN)
        & (bil.year <= YEAR)
        & (bil.year >= YEAR - LOCF)
        & (bil.variable_id.isin(BILAT))
        & (bil.iso3_d.isin(cands))
    ]
    bbest: dict[tuple[str, str], tuple[int, float]] = {}
    for row in bil.itertuples(index=False):
        if pd.isna(row.value):
            continue
        key = (str(row.iso3_d), str(row.variable_id))
        year = int(row.year)
        prev = bbest.get(key)
        if prev is None or year > prev[0]:
            bbest[key] = (year, float(row.value))

    used = {vid for _iso, vid in best} | {vid for _iso, vid in cbest} | {
        vid for _iso, vid in bbest
    }
    final: list[str] = []
    sources: set[str] = set()
    for vid in list(PRODUCT) + country_wanted + list(BILAT):
        if vid not in used or vid in final:
            continue
        meta = vars_meta.get(vid)
        if not meta:
            continue
        srcs = meta.get("source_ids") or []
        if any(source in BLOCKED for source in srcs):
            continue
        final.append(vid)
        sources.update(srcs)

    elapsed = time.perf_counter() - t0
    print(
        json.dumps(
            {
                "project": f"{ORIGIN}·{HS}·{YEAR}",
                "release": str(rel.relative_to(root)),
                "n_variables": len(final),
                "variables": final,
                "n_sources": len(sources),
                "sources": sorted(sources),
                "n_candidates": len(cands),
                "seconds": round(elapsed, 3),
            },
            indent=2,
        ),
    )


if __name__ == "__main__":
    main()
