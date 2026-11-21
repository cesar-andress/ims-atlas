#!/usr/bin/env python3
"""Repair empty internal release country_product/trade from curated tables.

Cause (2026-11-21): a full release ran while BACI-derived curated
``country_product`` was empty (hourly extract reported unchanged / no
``trade_hs6``), wrote ``hs2=_empty`` into ``data/release/internal/v1.1.0``,
and overwrote the previous good partitions. Curated was later restored
(≥90 HS2 chapters) but the release tree was not rebuilt.

This script copies the previous internal release to a **new** version,
replaces ``country_product`` and ``trade`` from curated, updates CURRENT,
and keeps the broken version for rollback (promote prune keeps 3).

Usage (on vpn-aplicaciones, from repo root)::

    docker run --rm -v \"$PWD:/w\" -w /w --memory=24g \\
      ghcr.io/astral-sh/uv:python3.11-bookworm-slim \\
      bash -lc 'cd /w/etl && uv sync --extra backtest --group dev \\
        && uv run python ../scripts/repair_internal_release_product.py \\
        --from-version 1.1.0 --to-version 1.2.0'

Never sets promoted_by to a person name (uses ``pipeline``).
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _chapters(path: Path) -> list[str]:
    if not path.is_dir():
        return []
    return sorted(
        d.name.split("=", 1)[1]
        for d in path.iterdir()
        if d.is_dir() and d.name.startswith("hs2=") and "_empty" not in d.name
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repo root (default: parent of scripts/ or $ATLAS_ROOT)",
    )
    parser.add_argument("--from-version", default="1.1.0")
    parser.add_argument("--to-version", default="1.2.0")
    parser.add_argument("--min-chapters", type=int, default=90)
    args = parser.parse_args()

    if args.root is not None:
        root = args.root.resolve()
    elif (atlas := (Path(__file__).resolve().parents[1])).joinpath("data").is_dir():
        root = atlas
    elif (env_root := __import__("os").environ.get("ATLAS_ROOT")):
        root = Path(env_root).resolve()
    else:
        root = Path.cwd().resolve()
    sys.path.insert(0, str(root / "etl" / "src"))

    from imsatlas_etl.pipeline.integrity import write_sha256sums
    from imsatlas_etl.pipeline.release_tables import (
        build_trade_hs2,
        write_trade_partitions,
    )

    curated = root / "data" / "curated"
    internal = root / "data" / "release" / "internal"
    src = internal / f"v{args.from_version}"
    dest = internal / f"v{args.to_version}"
    by_hs2 = curated / "country_product_by_hs2"
    flat = curated / "country_product.parquet"

    chapters = _chapters(by_hs2)
    if len(chapters) < args.min_chapters:
        raise SystemExit(
            f"curated country_product_by_hs2 has {len(chapters)} chapters "
            f"(need ≥ {args.min_chapters}); abort",
        )
    if not flat.is_file() or flat.stat().st_size < 1_000_000:
        raise SystemExit(
            f"curated country_product.parquet missing or tiny: {flat}",
        )
    if not src.is_dir():
        raise SystemExit(f"source release missing: {src}")

    if dest.exists():
        shutil.rmtree(dest)
    print(f"copy {src.name} -> {dest.name}", flush=True)
    shutil.copytree(src, dest)

    cp_dest = dest / "country_product"
    if cp_dest.exists():
        shutil.rmtree(cp_dest)
    print(f"copy curated partitions ({len(chapters)} HS2) -> {cp_dest}", flush=True)
    shutil.copytree(by_hs2, cp_dest)
    # Drop empty placeholder if curated still has it.
    empty = cp_dest / "hs2=_empty"
    if empty.exists():
        shutil.rmtree(empty)

    trade_dest = dest / "trade"
    if trade_dest.exists():
        shutil.rmtree(trade_dest)
    print("rebuild trade partitions from curated trade_hs2.parquet", flush=True)
    trade = build_trade_hs2(root=root)
    trade_paths = write_trade_partitions(trade, trade_dest)
    trade_chapters = _chapters(trade_dest)
    if len(trade_chapters) < args.min_chapters:
        raise SystemExit(
            f"trade rebuild produced {len(trade_chapters)} chapters "
            f"(need ≥ {args.min_chapters})",
        )

    cp_bytes = sum(p.stat().st_size for p in cp_dest.rglob("*.parquet"))
    if cp_bytes < 10 * 1024 * 1024:
        raise SystemExit(f"country_product only {cp_bytes} bytes (<10 MB)")

    manifest_path = dest / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    row_counts = dict(manifest.get("row_counts") or {})
    row_counts["country_product_parts"] = len(list(cp_dest.rglob("part.parquet")))
    row_counts["country_product_rows"] = None  # unknown without full scan
    row_counts["country_product_bytes"] = cp_bytes
    row_counts["country_product_chapters"] = len(chapters)
    row_counts["trade_parts"] = len(trade_paths)
    row_counts["trade_rows"] = int(len(trade))
    row_counts["repaired_from"] = args.from_version
    row_counts["repair_note"] = (
        "Restored country_product + trade from curated after empty "
        "v1.1.0 release (BACI extract unchanged → empty rebuild)."
    )
    manifest["version"] = args.to_version
    manifest["row_counts"] = row_counts
    manifest["staging"] = False
    manifest["audience"] = "internal"
    manifest["promoted_by"] = "pipeline"
    manifest["promoted_at"] = _now()
    manifest["repaired_at"] = _now()
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    write_sha256sums(dest)

    current = internal / "CURRENT"
    current.write_text(f"v{args.to_version}\n", encoding="utf-8")

    status = root / "status"
    status.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": "internal-release-repair/v1",
        "at": _now(),
        "from_version": args.from_version,
        "to_version": args.to_version,
        "country_product_chapters": len(chapters),
        "country_product_bytes": cp_bytes,
        "trade_chapters": len(trade_chapters),
        "trade_rows": int(len(trade)),
        "cause": (
            "Release v1.1.0 country_product was overwritten with hs2=_empty when "
            "a dual-release ran while curated country_product was empty "
            "(BACI extracted=false / trade_hs6 empty). Curated was later "
            "rebuilt (≥90 chapters); this repair copies curated partitions "
            "into a new internal version without overwriting v1.1.0."
        ),
    }
    (status / "internal_release_repair.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2), flush=True)
    print(f"CURRENT -> v{args.to_version}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
