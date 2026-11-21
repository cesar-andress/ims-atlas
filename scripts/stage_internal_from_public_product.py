#!/usr/bin/env python3
"""Stage internal v1.1.0 using live country/bilateral + public country_product.

Workaround for OOM / flaky nested parquet writes when re-nesting the full
87M-row product frame for the internal audience. Product metrics come from
BACI and are identical across audiences once gated.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path

_ETL_SRC = Path(__file__).resolve().parents[1] / "etl" / "src"
if str(_ETL_SRC) not in sys.path:
    sys.path.insert(0, str(_ETL_SRC))

from imsatlas_etl.pipeline.io_paths import (
    public_release_dir,
    staging_internal_release_dir,
)
from imsatlas_etl.pipeline.release import _variable_gates, _write_catalog_json
from imsatlas_etl.pipeline.release_tables import (
    build_bilateral_year_long,
    build_country_year_long,
    build_trade_hs2,
    write_trade_partitions,
)


def main() -> None:
    root = Path(os.environ.get("ATLAS_ROOT", Path(__file__).resolve().parents[1]))
    version = os.environ.get("ATLAS_RELEASE_VERSION", "1.1.0")
    dest = staging_internal_release_dir(root=root) / f"v{version}"
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)

    gates = _variable_gates(audience="internal")
    included = {g["id"] for g in gates if g.get("included")}
    print(f"included_vars={len(included)}", flush=True)

    country = build_country_year_long(root=root, included_ids=included)
    bilateral = build_bilateral_year_long(root=root, included_ids=included)
    trade = build_trade_hs2(root=root)
    country.to_parquet(dest / "country_year.parquet", index=False)
    bilateral.to_parquet(dest / "bilateral_year.parquet", index=False)
    print(f"country_year_rows={len(country)} bilateral_rows={len(bilateral)}", flush=True)
    write_trade_partitions(trade, dest / "trade")
    print(f"trade_rows={len(trade)}", flush=True)

    src_cp = public_release_dir(root=root) / f"v{version}" / "country_product"
    if not src_cp.is_dir():
        raise SystemExit(f"missing public country_product at {src_cp}")
    print(f"copy {src_cp} → {dest / 'country_product'}", flush=True)
    shutil.copytree(src_cp, dest / "country_product")
    n_chapters = len(list((dest / "country_product").glob("hs2=*")))
    print(f"country_product_chapters={n_chapters}", flush=True)

    try:
        _write_catalog_json(dest, included)
    except Exception as exc:  # noqa: BLE001 — best-effort packaging
        print(f"catalog note: {exc}", flush=True)
        pub_cat = public_release_dir(root=root) / f"v{version}" / "catalog.json"
        if pub_cat.is_file():
            shutil.copy2(pub_cat, dest / "catalog.json")

    for name in ("README.md", "CHANGELOG.md", "LICENSES.md"):
        src = public_release_dir(root=root) / f"v{version}" / name
        if src.is_file():
            shutil.copy2(src, dest / name)

    manifest = {
        "version": version,
        "audience": "internal",
        "created_at": datetime.now(UTC)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "variables": sorted(included),
        "n_included_variables": len(included),
        "row_counts": {
            "country_year_rows": int(len(country)),
            "bilateral_year_rows": int(len(bilateral)),
            "trade_rows": int(len(trade)),
            "country_product_chapters": n_chapters,
            "country_product_source": "copied_from_public_release",
        },
        "staging": True,
    }
    (dest / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"DONE staging {dest}", flush=True)


if __name__ == "__main__":
    main()
