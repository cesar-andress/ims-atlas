"""Human verification of catalog variables (status: verified)."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from imsatlas_etl.catalog import (
    CatalogValidationError,
    assert_valid_catalog,
    load_catalog,
)
from imsatlas_etl.paths import catalog_yaml_path


def _today_utc() -> str:
    return datetime.now(UTC).date().isoformat()


def verify_variable(
    var_id: str,
    *,
    by: str,
    on: str | None = None,
    catalog_path: Path | None = None,
) -> dict[str, Any]:
    """Set status=verified for one variable; record verified_by / verified_on."""
    who = by.strip()
    if not who:
        raise CatalogValidationError("--by must be a non-empty human name")
    when = on or _today_utc()
    path = catalog_path or catalog_yaml_path()
    data = load_catalog(path)
    variables = data.get("variables")
    if not isinstance(variables, list):
        raise CatalogValidationError("catalog variables missing")
    found: dict[str, Any] | None = None
    for var in variables:
        if isinstance(var, dict) and var.get("id") == var_id:
            found = var
            break
    if found is None:
        raise CatalogValidationError(f"unknown variable id: {var_id}")
    found["status"] = "verified"
    found["verified_by"] = who
    found["verified_on"] = when
    assert_valid_catalog(data)
    path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return {
        "id": var_id,
        "status": "verified",
        "verified_by": who,
        "verified_on": when,
        "path": str(path),
    }
