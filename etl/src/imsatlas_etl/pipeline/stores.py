"""Materialise abierta / cerrada Parquet stores from the curated panel."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from imsatlas_etl.access import (
    StoreKind,
    source_store,
    source_store_reason,
    store_manifest_path,
    store_root,
    taint,
)
from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.pipeline.integrity import sha256_file
from imsatlas_etl.pipeline.io_paths import curated_dir
from imsatlas_etl.sources import load_sources, sources_by_id


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def variable_store(
    variable: dict[str, Any],
    registry: dict[str, dict[str, Any]],
) -> StoreKind:
    """Variable inherits the most restrictive source store (taint)."""
    stores: list[StoreKind] = []
    for sid in variable.get("source_ids") or []:
        src = registry.get(str(sid)) or {}
        stores.append(source_store(src.get("rights")))
    return taint(*stores) if stores else "cerrada"


def _registry(*, root: Path | None) -> dict[str, dict[str, Any]]:
    if root is not None and (root / "catalog" / "sources.yaml").is_file():
        data = load_sources(root / "catalog" / "sources.yaml")
        return {s["id"]: s for s in data.get("sources") or []}
    return sources_by_id()


def _catalog(*, root: Path | None) -> dict[str, Any]:
    if root is not None and (root / "catalog" / "variables.yaml").is_file():
        return load_catalog(root / "catalog" / "variables.yaml")
    return load_catalog()


def source_assignments(*, root: Path | None = None) -> list[dict[str, Any]]:
    registry = _registry(root=root)
    rows = []
    for sid, src in sorted(registry.items()):
        rights = src.get("rights")
        kind = source_store(rights)
        rows.append(
            {
                "id": sid,
                "store": kind,
                "reason": source_store_reason(rights),
            },
        )
    return rows


def write_stores(*, root: Path | None = None) -> dict[str, Any]:
    """
    Split curated long tables into data/store/{abierta,cerrada}/.

    A source is never written to both stores. Variables with mixed inputs
    are placed in cerrada (taint). Empty stores still get a manifest.
    """
    try:
        registry = _registry(root=root)
        catalog = _catalog(root=root)
    except FileNotFoundError:
        registry = {}
        catalog = {"variables": []}
    assignments = {
        sid: source_store(src.get("rights")) for sid, src in registry.items()
    }
    var_store: dict[str, StoreKind] = {
        str(v["id"]): variable_store(v, registry)
        for v in catalog.get("variables") or []
    }

    curated = curated_dir(root=root)
    country_src = curated / "variables_country_year.parquet"
    bilateral_src = curated / "bilateral_year.parquet"

    country_wide = (
        pd.read_parquet(country_src)
        if country_src.is_file()
        else pd.DataFrame(columns=["iso3", "year"])
    )
    # Stores expect long form (iso3, year, variable_id, value).
    if (
        not country_wide.empty
        and "variable_id" not in country_wide.columns
        and {"iso3", "year"}.issubset(country_wide.columns)
    ):
        value_cols = [c for c in country_wide.columns if c not in {"iso3", "year"}]
        country = country_wide.melt(
            id_vars=["iso3", "year"],
            value_vars=value_cols,
            var_name="variable_id",
            value_name="value",
        ).dropna(subset=["value"])
    elif not country_wide.empty and "variable_id" in country_wide.columns:
        country = country_wide
    else:
        country = pd.DataFrame(columns=["iso3", "year", "variable_id", "value"])
    bilateral = (
        pd.read_parquet(bilateral_src)
        if bilateral_src.is_file()
        else pd.DataFrame(
            columns=["iso3_o", "iso3_d", "year", "variable_id", "value"],
        )
    )

    report: dict[str, Any] = {"generated_at": _now_iso(), "stores": {}}
    for kind in ("abierta", "cerrada"):
        dest = store_root(kind, root=root)  # type: ignore[arg-type]
        dest.mkdir(parents=True, exist_ok=True)
        allowed_vars = {vid for vid, st in var_store.items() if st == kind}
        if not country.empty and "variable_id" in country.columns:
            c_out = country[country["variable_id"].isin(allowed_vars)]
        else:
            c_out = country.iloc[0:0]
        if not bilateral.empty and "variable_id" in bilateral.columns:
            b_out = bilateral[bilateral["variable_id"].isin(allowed_vars)]
        else:
            b_out = bilateral.iloc[0:0]
        c_path = dest / "country_year.parquet"
        b_path = dest / "bilateral_year.parquet"
        c_out.to_parquet(c_path, index=False)
        b_out.to_parquet(b_path, index=False)
        source_ids = sorted(sid for sid, st in assignments.items() if st == kind)
        files = {
            "country_year.parquet": {
                "sha256": sha256_file(c_path),
                "rows": int(len(c_out)),
                "bytes": c_path.stat().st_size,
            },
            "bilateral_year.parquet": {
                "sha256": sha256_file(b_path),
                "rows": int(len(b_out)),
                "bytes": b_path.stat().st_size,
            },
        }
        manifest = {
            "schema": "ims-atlas-store/v1",
            "store": kind,
            "generated_at": _now_iso(),
            "source_ids": source_ids,
            "variable_ids": sorted(allowed_vars),
            "n_sources": len(source_ids),
            "n_variables": len(allowed_vars),
            "files": files,
            "source_assignments": [
                {
                    "id": sid,
                    "store": kind,
                    "reason": source_store_reason(
                        (registry.get(sid) or {}).get("rights"),
                    ),
                }
                for sid in source_ids
            ],
        }
        store_manifest_path(kind, root=root).write_text(  # type: ignore[arg-type]
            json.dumps(manifest, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        report["stores"][kind] = {
            "path": str(dest),
            "n_sources": len(source_ids),
            "n_variables": len(allowed_vars),
            "country_year_rows": int(len(c_out)),
            "bilateral_year_rows": int(len(b_out)),
            "bytes": sum(f["bytes"] for f in files.values()),
        }
    return report
