"""Step 7: lineage DAG status/lineage.json."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.pipeline.io_paths import (
    PIPELINE_SOURCES,
    curated_dir,
    freshness_path,
    public_release_dir,
    raw_source_dir,
    status_root,
)
from imsatlas_etl.rights import gate_for_variable, load_deployment
from imsatlas_etl.sources import sources_by_id


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_lineage(*, root: Path | None = None) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []

    freshness = {}
    fpath = freshness_path(root=root)
    if fpath.is_file():
        payload = json.loads(fpath.read_text(encoding="utf-8"))
        freshness = {r["source"]: r for r in payload.get("sources", [])}

    for source_id in PIPELINE_SOURCES:
        nodes.append(
            {
                "id": f"source:{source_id}",
                "kind": "source",
                "label": source_id,
            }
        )
        version = None
        row = freshness.get(source_id)
        if row:
            version = row.get("ingested_version") or row.get("upstream_version")
        if version:
            raw_id = f"raw:{source_id}:{version}"
            nodes.append(
                {
                    "id": raw_id,
                    "kind": "raw",
                    "label": f"{source_id}/{version}",
                    "exists": raw_source_dir(
                        source_id,
                        str(version),
                        root=root,
                    ).is_dir(),
                },
            )
            edges.append({"from": f"source:{source_id}", "to": raw_id})
            for curated_name in (
                "country_year",
                "bilateral_year",
                "trade_hs2",
                "trade_hs4",
                "trade_hs6",
            ):
                cid = f"curated:{curated_name}"
                if not any(n["id"] == cid for n in nodes):
                    path = curated_dir(root=root) / (
                        f"{curated_name}.parquet"
                        if curated_name != "trade_hs6"
                        else "trade_hs6"
                    )
                    nodes.append(
                        {
                            "id": cid,
                            "kind": "curated",
                            "label": curated_name,
                            "exists": path.exists(),
                        },
                    )
                edges.append({"from": raw_id, "to": cid})

    registry = sources_by_id()
    deployment = load_deployment()
    catalog = load_catalog()
    for variable in catalog["variables"]:
        vid = variable["id"]
        gate = gate_for_variable(variable, registry=registry, deployment=deployment)
        node_id = f"variable:{vid}"
        nodes.append(
            {
                "id": node_id,
                "kind": "variable",
                "label": vid,
                "gate": gate["decision"],
            },
        )
        for sid in variable.get("source_ids") or []:
            edges.append({"from": f"source:{sid}", "to": node_id})
        # Variables feed curated country/bilateral conceptually
        if variable.get("level") in {"country", "country_product"}:
            edges.append({"from": node_id, "to": "curated:country_year"})
        if "bilateral" in str(variable.get("level", "")):
            edges.append({"from": node_id, "to": "curated:bilateral_year"})

    public = public_release_dir(root=root)
    if public.is_dir():
        for release in sorted(p for p in public.iterdir() if p.is_dir()):
            rid = f"release:{release.name}"
            nodes.append(
                {
                    "id": rid,
                    "kind": "release",
                    "label": release.name,
                    "exists": True,
                },
            )
            for curated_name in (
                "country_year",
                "bilateral_year",
                "trade_hs2",
                "trade_hs4",
                "trade_hs6",
            ):
                edges.append({"from": f"curated:{curated_name}", "to": rid})

    # Deduplicate edges
    seen: set[tuple[str, str]] = set()
    uniq_edges: list[dict[str, str]] = []
    for edge in edges:
        key = (edge["from"], edge["to"])
        if key in seen:
            continue
        seen.add(key)
        uniq_edges.append(edge)

    return {
        "generated_at": _now_iso(),
        "nodes": nodes,
        "edges": uniq_edges,
    }


def write_lineage(*, root: Path | None = None) -> Path:
    payload = build_lineage(root=root)
    out = status_root(root=root)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "lineage.json"
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return path
