#!/usr/bin/env python3
"""Count variables/sources a project panel would mount (Prompt 4a report)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pandas as pd

PRODUCT = ["IMPV", "IMPC", "GRW", "HHI", "ASIASH", "REEXP", "UVGAP", "PPAD"]
BILATERAL = ["DIST", "LANG", "FTA"]
BLOCKED = {"ecb_fx", "vat_rates"}
LOCF = 5


def main() -> None:
    root = Path(os.environ.get("ATLAS_ROOT", Path(__file__).resolve().parents[1]))
    origin = os.environ.get("ORIGIN", "ESP")
    hs = os.environ.get("HS", "0901")
    year = int(os.environ.get("YEAR", "2024"))
    audience = os.environ.get("AUDIENCE", "internal")
    base = root / "data" / "release" / audience / "v1.1.0"
    hs2 = hs.replace(r"\D", "")[:2].zfill(2)
    hs_digits = "".join(c for c in hs if c.isdigit())
    hs2 = hs_digits[:2].zfill(2)
    hs_level = "hs2" if len(hs_digits) <= 2 else "hs4" if len(hs_digits) <= 4 else "hs6"
    hs_code = hs2 if hs_level == "hs2" else hs_digits

    idx_path = base / "country_product" / f"hs2={hs2}" / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    wanted = set(PRODUCT)
    files: list[Path] = []
    for rel in idx.get("parts") or []:
        if not rel.startswith("year="):
            continue
        y = int(rel.split("/")[0].split("=")[1])
        if y < year - LOCF or y > year:
            continue
        vid = rel.split("variable_id=")[1].split("/")[0]
        if vid not in wanted:
            continue
        files.append(base / "country_product" / f"hs2={hs2}" / rel)
    print(f"product_parts={len(files)}", flush=True)
    prod = pd.concat([pd.read_parquet(p) for p in files], ignore_index=True)
    prod = prod[
        (prod["hs_level"] == hs_level) & (prod["hs_code"].astype(str) == hs_code)
    ]
    product_best: dict[tuple[str, str], tuple[int, float]] = {}
    for (iso, vid), g in prod.groupby(["iso3", "variable_id"]):
        row = g.sort_values("year").iloc[-1]
        product_best[(str(iso), str(vid))] = (int(row.year), float(row.value))
    cand = {
        iso
        for (iso, vid), (_y, val) in product_best.items()
        if vid == "IMPV" and val > 0
    }
    print(f"candidates={len(cand)}", flush=True)
    product_vars = sorted({vid for (iso, vid) in product_best if iso in cand})

    cy = pd.read_parquet(base / "country_year.parquet")
    cy = cy[(cy["year"] <= year) & (cy["year"] >= year - LOCF)]
    country_best: dict[tuple[str, str], tuple[int, float]] = {}
    for (iso, vid), g in cy.groupby(["iso3", "variable_id"]):
        if str(iso) not in cand:
            continue
        row = g.sort_values("year").iloc[-1]
        country_best[(str(iso), str(vid))] = (int(row.year), float(row.value))
    country_vars = sorted({vid for (_iso, vid) in country_best})

    bil = pd.read_parquet(base / "bilateral_year.parquet")
    bil = bil[
        (bil["iso3_o"] == origin)
        & (bil["year"] <= year)
        & (bil["year"] >= year - LOCF)
        & (bil["variable_id"].isin(BILATERAL))
    ]
    bil_best: dict[tuple[str, str], tuple[int, float]] = {}
    for (iso, vid), g in bil.groupby(["iso3_d", "variable_id"]):
        if str(iso) not in cand:
            continue
        row = g.sort_values("year").iloc[-1]
        bil_best[(str(iso), str(vid))] = (int(row.year), float(row.value))
    bil_vars = sorted({vid for (_iso, vid) in bil_best})

    all_vars = sorted(set(product_vars) | set(country_vars) | set(bil_vars))
    cat = json.loads((base / "catalog.json").read_text(encoding="utf-8"))
    by = {v["id"]: v for v in cat["variables"]}
    srcs: set[str] = set()
    for vid in all_vars:
        for sid in by.get(vid, {}).get("source_ids") or []:
            if sid not in BLOCKED:
                srcs.add(sid)

    print(f"origin={origin} hs={hs} year={year} audience={audience}")
    print(f"TOTAL_VARS={len(all_vars)}")
    print("VARS=" + ",".join(all_vars))
    print(f"TOTAL_SOURCES={len(srcs)}")
    print("SOURCES=" + ",".join(sorted(srcs)))
    print(f"product_n={len(product_vars)} country_n={len(country_vars)} bil_n={len(bil_vars)}")
    lpi = sum(1 for (iso, vid) in country_best if vid == "LPI")
    print(f"LPI_markets={lpi}")
    print(f"blocked_leak={sorted(srcs & BLOCKED)}")


if __name__ == "__main__":
    main()
