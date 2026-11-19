#!/usr/bin/env python3
"""Extract IMSFE 2025 mean weights from Jose's workbook (local path only).

Usage:
  IMSFE_WORKBOOK_PATH=/path/to/workbook.xlsx \\
    uv run python scripts/extract_imsfe_workbook_weights.py

Never prints or writes expert personal names — only Expert 1..n.
Does not write fixtures unless --write-json is given (ask before committing).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from openpyxl import load_workbook

CRITERIA = ["COST", "LOGI", "COMM", "ECON", "POLI", "CULT"]
# Columns on sheet "1. Total Average for criteria" for factor means (row 22 formulas).
FACTOR_COLS = {"COST": 3, "LOGI": 7, "COMM": 11, "ECON": 15, "POLI": 19, "CULT": 23}
# Variable within-factor means live on row 41 (data_only).
VAR_BLOCKS = {
    "COST": [("PPAD", 3), ("INTC", 4), ("CIBC", 5)],
    "LOGI": [("LPIN", 7), ("CPTR", 8), ("ITTT", 9)],
    "COMM": [("CUTA", 11), ("CCTI", 12), ("IOEF", 13)],
    "ECON": [("CLI", 15), ("INAN", 16), ("UNRA", 17)],
    "POLI": [("FSIN", 19), ("INRI", 20), ("DEIN", 21)],
    "CULT": [("GLIN", 23), ("CPIN", 24), ("CUDI", 25)],
}


def extract(path: Path) -> dict:
    wb = load_workbook(path, data_only=True)
    ws = wb["1. Total Average for criteria"]
    factors: dict[str, float] = {}
    for name, col in FACTOR_COLS.items():
        val = ws.cell(22, col).value
        if not isinstance(val, (int, float)):
            raise SystemExit(f"missing factor mean {name} at col {col}: {val!r}")
        factors[name] = float(val)

    variables: dict[str, float] = {}
    within: dict[str, dict[str, float]] = {}
    for factor, pairs in VAR_BLOCKS.items():
        within[factor] = {}
        for vid, col in pairs:
            val = ws.cell(41, col).value
            if not isinstance(val, (int, float)):
                raise SystemExit(f"missing variable mean {vid}: {val!r}")
            variables[vid] = float(val)
            within[factor][vid] = float(val)

    # Count expert rows without reading names (rows 6..20 for factors).
    n_experts = 0
    for row in range(6, 21):
        if isinstance(ws.cell(row, 3).value, (int, float)):
            n_experts += 1

    return {
        "schema": "imsfe-workbook-weights/v1",
        "source_sheet": "1. Total Average for criteria",
        "n_experts": n_experts,
        "expert_labels": [f"Expert {i}" for i in range(1, n_experts + 1)],
        "criteria": CRITERIA,
        "factor_means": factors,
        "variable_means": variables,
        "variables_within": within,
        "note": (
            "Means from workbook data_only cache. Personal names were not exported. "
            "Ask before committing any golden derived from this file."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--workbook",
        default=os.environ.get("IMSFE_WORKBOOK_PATH", ""),
        help="Path to the IMSFE xlsx (or set IMSFE_WORKBOOK_PATH)",
    )
    parser.add_argument(
        "--write-json",
        type=Path,
        default=None,
        help="Optional output path (do not commit without human OK)",
    )
    args = parser.parse_args()
    if not args.workbook:
        print(
            "IMSFE_WORKBOOK_PATH not set; skipping extract.",
            file=sys.stderr,
        )
        raise SystemExit(0)
    path = Path(args.workbook)
    if not path.is_file():
        raise SystemExit(f"workbook not found: {path}")
    payload = extract(path)
    text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if args.write_json:
        args.write_json.parent.mkdir(parents=True, exist_ok=True)
        args.write_json.write_text(text, encoding="utf-8")
        print(f"wrote {args.write_json}", file=sys.stderr)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
