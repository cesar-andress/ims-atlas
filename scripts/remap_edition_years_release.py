#!/usr/bin/env python3
"""Remap EPI/GII(/optional CC) edition years in an existing internal release copy.

Does not download anything. Writes a **new** version directory (never overwrites).

Example::

    ATLAS_ROOT=/opt/services/ims-atlas \\
      python scripts/remap_edition_years_release.py --from 1.2.0 --to 1.3.0
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import pandas as pd

# Same lags as etl variables_build.INDEX_EDITION_LAG (+ CC fix for LOCF 2024).
REMAP: dict[str, dict[int, int]] = {
    "EPI": {2026: 2024},
    "GII": {2026: 2025, 2025: 2024},
    "CC": {2025: 2024},
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path("."))
    ap.add_argument("--from", dest="from_ver", required=True)
    ap.add_argument("--to", dest="to_ver", required=True)
    ap.add_argument("--set-current", action="store_true")
    args = ap.parse_args()
    root: Path = args.root
    src = root / "data/release/internal" / f"v{args.from_ver}"
    dst = root / "data/release/internal" / f"v{args.to_ver}"
    if not src.is_dir():
        raise SystemExit(f"missing source release {src}")
    if dst.exists():
        raise SystemExit(f"refusing to overwrite {dst}")
    shutil.copytree(src, dst)
    cy_path = dst / "country_year.parquet"
    cy = pd.read_parquet(cy_path)
    n_changed = 0
    for vid, mapping in REMAP.items():
        mask = cy["variable_id"] == vid
        for old, new in mapping.items():
            hit = mask & (cy["year"] == old)
            n = int(hit.sum())
            if n:
                cy.loc[hit, "year"] = new
                n_changed += n
                print(f"{vid}: {old} → {new} ({n} rows)")
    cy.to_parquet(cy_path, index=False)
    note = {
        "from": args.from_ver,
        "to": args.to_ver,
        "n_year_cells_remapped": n_changed,
        "remap": REMAP,
        "note": "Edition→data year for LOCF; no new upstream download.",
    }
    (dst / "edition_year_remap.json").write_text(
        json.dumps(note, indent=2) + "\n",
        encoding="utf-8",
    )
    if args.set_current:
        (root / "data/release/internal/CURRENT").write_text(
            f"v{args.to_ver}\n",
            encoding="utf-8",
        )
        print("CURRENT →", f"v{args.to_ver}")
    print("done", note)


if __name__ == "__main__":
    main()
