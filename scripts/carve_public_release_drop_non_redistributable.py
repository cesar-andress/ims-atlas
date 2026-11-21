#!/usr/bin/env python3
"""Carve a new public release from an existing one, dropping redistributable:false.

P0 prudent exception: public v1.3.1 = v1.3.0 without PPAD/CIBC/LPIN/CPTR/CLI/
INAN/UNRA/INRI/CPIN. Does NOT invent data. Does NOT overwrite the source tree.

Usage (on server, ATLAS_ROOT=/opt/services/ims-atlas):
  python3 scripts/carve_public_release_drop_non_redistributable.py \\
    --from-version 1.3.0 --to-version 1.3.1 --by "César Andrés"
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import yaml

DEFAULT_DROP = frozenset(
    {"PPAD", "CIBC", "LPIN", "CPTR", "CLI", "INAN", "UNRA", "INRI", "CPIN"}
)


def _load_catalog_redistributable(root: Path) -> dict[str, bool]:
    path = root / "catalog" / "variables.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    out: dict[str, bool] = {}
    for row in data.get("variables") or []:
        vid = str(row.get("id") or "")
        if vid:
            out[vid] = row.get("redistributable") is True
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, default=Path("."))
    p.add_argument("--from-version", required=True)
    p.add_argument("--to-version", required=True)
    p.add_argument("--by", required=True, help="promoted_by label (human name)")
    p.add_argument(
        "--drop-ids",
        default=",".join(sorted(DEFAULT_DROP)),
        help="comma-separated variable ids to exclude",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="print plan only; do not write",
    )
    args = p.parse_args()
    root = args.root.resolve()
    drop = {x.strip() for x in args.drop_ids.split(",") if x.strip()}
    src = root / "data" / "release" / "public" / f"v{args.from_version}"
    dest = root / "data" / "release" / "public" / f"v{args.to_version}"
    if not src.is_dir():
        print(f"ERROR: missing source {src}", file=sys.stderr)
        return 1
    if dest.exists():
        print(
            f"ERROR: destination exists {dest} (immutable; delete by hand)",
            file=sys.stderr,
        )
        return 1

    redist = _load_catalog_redistributable(root)
    for vid in sorted(drop):
        if redist.get(vid) is True:
            print(
                f"WARN: {vid} is redistributable:true in catalog but listed to drop",
            )

    cat = json.loads((src / "catalog.json").read_text(encoding="utf-8"))
    before_ids = [v["id"] for v in cat.get("variables") or []]
    kept = [v for v in cat.get("variables") or [] if v.get("id") not in drop]
    removed = [i for i in before_ids if i in drop]
    print(f"from v{args.from_version}: {len(before_ids)} vars")
    print(f"drop ({len(removed)}): {', '.join(removed)}")
    print(f"keep: {len(kept)} vars → v{args.to_version}")
    missing_drop = sorted(drop - set(before_ids))
    if missing_drop:
        print(f"note: not in source catalog: {', '.join(missing_drop)}")

    if args.dry_run:
        print("DRY-RUN: no files written")
        return 0

    shutil.copytree(src, dest)

    # Filter country_year
    cy_path = dest / "country_year.parquet"
    if cy_path.is_file():
        cy = pd.read_parquet(cy_path)
        if "variable_id" in cy.columns:
            before_n = len(cy)
            cy = cy[~cy["variable_id"].isin(drop)].reset_index(drop=True)
            cy.to_parquet(cy_path, index=False)
            print(f"country_year rows {before_n} → {len(cy)}")

    # Catalog + manifest
    cat["variables"] = kept
    cat["version"] = args.to_version
    cat["audience"] = "public"
    (dest / "catalog.json").write_text(
        json.dumps(cat, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    man_path = dest / "manifest.json"
    man = json.loads(man_path.read_text(encoding="utf-8"))
    now = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    man["version"] = args.to_version
    man["audience"] = "public"
    man["staging"] = False
    man["promoted_by"] = args.by
    man["promoted_at"] = now
    man["n_included_variables"] = len(kept)
    # Keep gate rows but mark dropped as not included if present
    gates = []
    for g in man.get("variables") or []:
        g2 = dict(g)
        if g2.get("id") in drop:
            g2["included"] = False
            reasons = list(g2.get("reasons") or [])
            reasons.append("carved out: variable redistributable=false (P0)")
            g2["reasons"] = reasons
        gates.append(g2)
    man["variables"] = gates
    rc = dict(man.get("row_counts") or {})
    if cy_path.is_file():
        rc["country_year_rows"] = int(len(pd.read_parquet(cy_path)))
    rc["carved_from"] = f"v{args.from_version}"
    rc["carved_drop_ids"] = sorted(drop)
    rc["carved_at"] = now
    man["row_counts"] = rc
    man_path.write_text(json.dumps(man, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    # CHANGELOG note
    cl = dest / "CHANGELOG.md"
    note = (
        f"\n## v{args.to_version} (public carve)\n\n"
        f"- Derived from v{args.from_version} without non-redistributable "
        f"variables: {', '.join(sorted(removed))}.\n"
        f"- Internal audience unchanged.\n"
        f"- Promoted pointer update is separate (CURRENT).\n"
    )
    if cl.is_file():
        cl.write_text(cl.read_text(encoding="utf-8") + note, encoding="utf-8")
    else:
        cl.write_text(note.lstrip() + "\n", encoding="utf-8")

    # Refresh SHA256SUMS via ETL helper if available
    try:
        from imsatlas_etl.pipeline.integrity import write_sha256sums

        write_sha256sums(dest)
        print("SHA256SUMS rewritten")
    except Exception as exc:  # noqa: BLE001
        print(f"WARN: could not rewrite SHA256SUMS ({exc})")

    current = root / "data" / "release" / "public" / "CURRENT"
    current.write_text(f"v{args.to_version}\n", encoding="utf-8")
    print(f"CURRENT → v{args.to_version}")
    print("DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
