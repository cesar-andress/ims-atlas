#!/usr/bin/env python3
"""Stream BACI trade.csv into country_product partitions (memory-safe).

Run on the host with ATLAS_ROOT set (or default repo root), e.g.::

    cd etl && ATLAS_ROOT=/opt/services/ims-atlas \\
      uv run python ../scripts/rebuild_country_product_stream.py
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pandas as pd

# Allow running as ``uv run python ../scripts/...`` from etl/
_ETL_SRC = Path(__file__).resolve().parents[1] / "etl" / "src"
if str(_ETL_SRC) not in sys.path:
    sys.path.insert(0, str(_ETL_SRC))

from imsatlas_etl.pipeline.io_paths import curated_dir, freshness_path, status_root
from imsatlas_etl.pipeline.product_metrics import (
    compute_product_metrics,
    write_product_metrics_partitioned,
)

CHUNK = 750_000


def _root() -> Path:
    env = Path(__file__).resolve().parents[1]
    import os

    return Path(os.environ.get("ATLAS_ROOT", str(env)))


def _baci_trade_csv(root: Path) -> Path:
    payload = json.loads(freshness_path(root=root).read_text(encoding="utf-8"))
    version = None
    for row in payload.get("sources", []):
        if row.get("source") == "baci":
            version = row.get("ingested_version") or row.get("upstream_version")
            break
    if not version:
        raise SystemExit("baci not in freshness.json")
    path = root / "data" / "raw" / "baci" / str(version) / "trade.csv"
    if not path.is_file():
        raise SystemExit(f"missing {path}")
    return path


def main() -> None:
    root = _root()
    raw = _baci_trade_csv(root)
    tmp = Path("/tmp/atlas_trade_by_hs2")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)

    print(f"pass1: split {raw} by hs2…", flush=True)
    n = 0
    for chunk in pd.read_csv(
        raw,
        dtype={"hs6": str, "exporter": str, "importer": str},
        chunksize=CHUNK,
    ):
        chunk["year"] = chunk["year"].astype(int)
        chunk["hs6"] = chunk["hs6"].str.zfill(6)
        chunk["hs4"] = chunk["hs6"].str.slice(0, 4)
        chunk["hs2"] = chunk["hs6"].str.slice(0, 2)
        n += len(chunk)
        for hs2, group in chunk.groupby("hs2"):
            dest = tmp / f"hs2={hs2}"
            dest.mkdir(exist_ok=True)
            part = dest / f"part-{n:012d}.parquet"
            group.to_parquet(part, index=False)
        if n % (CHUNK * 10) < CHUNK:
            print(f"  rows {n:,}", flush=True)
    print(f"split done rows={n:,}", flush=True)

    out_dir = curated_dir(root=root)
    by_hs2 = out_dir / "country_product_by_hs2"
    if by_hs2.exists():
        shutil.rmtree(by_hs2)
    frames: list[pd.DataFrame] = []
    hs2_dirs = sorted(tmp.glob("hs2=*"))
    print(f"pass2: metrics for {len(hs2_dirs)} chapters…", flush=True)
    for i, directory in enumerate(hs2_dirs, 1):
        parts = list(directory.glob("*.parquet"))
        trade = pd.concat([pd.read_parquet(p) for p in parts], ignore_index=True)
        metrics = compute_product_metrics(trade, population=None)
        frames.append(metrics)
        print(
            f"  {directory.name} trade={len(trade):,} metrics={len(metrics):,} "
            f"({i}/{len(hs2_dirs)})",
            flush=True,
        )
        del trade, metrics, parts

    all_metrics = pd.concat(frames, ignore_index=True)
    flat = out_dir / "country_product.parquet"
    all_metrics.to_parquet(flat, index=False)
    parts_meta = write_product_metrics_partitioned(all_metrics, by_hs2)
    chapters = status_root(root=root) / "hs_chapters.json"
    chapters.parent.mkdir(parents=True, exist_ok=True)
    chapters.write_text(
        json.dumps(
            {
                "schema": "hs-chapters/v1",
                "hs_nomenclature": "HS2017",
                "country_product_rows": int(len(all_metrics)),
                "bytes_by_hs2": parts_meta.get("bytes_by_hs2", {}),
                "rows_by_hs2": parts_meta.get("rows_by_hs2", {}),
                "budget_max_single_file_bytes": 5_242_880,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        "DONE",
        {"rows": int(len(all_metrics)), "partitions": parts_meta},
        flush=True,
    )
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
