"""Export app/public/meta/catalog-preview.json for the Phase 7 catalog UI."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from imsatlas_etl.catalog import load_catalog
from imsatlas_etl.paths import repo_root
from imsatlas_etl.sources import load_sources, sources_by_id


def build_catalog_preview() -> dict[str, Any]:
    catalog = load_catalog()
    registry = sources_by_id(load_sources())
    variables: list[dict[str, Any]] = []
    for var in catalog["variables"]:
        licences: list[str] = []
        for sid in var.get("source_ids") or []:
            rights = (registry.get(sid) or {}).get("rights") or {}
            licences.append(str(rights.get("licence_id", "UNKNOWN")))
        years = var.get("years") or []
        # Synthetic coverage skeleton for heatmap (null cells = unknown).
        # Real coverage comes from status/coverage when ETL has run.
        coverage: dict[str, dict[str, float | None]] = {}
        if isinstance(years, list) and len(years) >= 2:
            y0, y1 = int(years[0]), int(years[1])
            year_list = list(range(y0, y1 + 1))
        elif isinstance(years, list) and len(years) == 1:
            year_list = [int(years[0])]
        else:
            year_list = []
        # Placeholder iso3 set for UI layout demos (not empirical coverage).
        demo_iso = [
            "COL",
            "PER",
            "MEX",
            "CHL",
            "BRA",
            "ARG",
            "USA",
            "DEU",
            "CHN",
            "ESP",
        ]
        for iso in demo_iso:
            coverage[iso] = {str(y): None for y in year_list}

        variables.append(
            {
                "id": var["id"],
                "name": var.get("name") or {"en": var["id"], "es": var["id"]},
                "factor": var["factor"],
                "direction": var.get("direction"),
                "status": var.get("status"),
                "redistributable": bool(var.get("redistributable")),
                "source_ids": list(var.get("source_ids") or []),
                "licence_ids": licences,
                "years": years,
                "citation": var.get("citation"),
                "coverage_demo": coverage,
            },
        )
    return {
        "schema": "catalog-preview/v1",
        "factors": catalog.get("factors", []),
        "variables": variables,
        "n_variables": len(variables),
        "note": (
            "Draft catalog for UI. Shipped release catalog.json may be a subset "
            "gated by licence. coverage_demo cells are null placeholders."
        ),
    }


def default_output_path() -> Path:
    return repo_root() / "app" / "public" / "meta" / "catalog-preview.json"


def write_catalog_preview(path: Path | None = None) -> Path:
    target = path or default_output_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = build_catalog_preview()
    target.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return target
