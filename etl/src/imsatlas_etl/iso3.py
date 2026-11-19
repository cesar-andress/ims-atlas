"""Explicit country-name → ISO3 mapping (no fuzzy matching)."""

from __future__ import annotations

from typing import Any

import pandas as pd

# Explicit allowlist only. Add rows when a publisher spelling is confirmed.
# Keys are lowercased stripped names.
NAME_TO_ISO3: dict[str, str] = {
    "spain": "ESP",
    "espana": "ESP",
    "españa": "ESP",
    "mexico": "MEX",
    "méxico": "MEX",
    "chile": "CHL",
    "united states": "USA",
    "united states of america": "USA",
    "usa": "USA",
    "france": "FRA",
    "germany": "DEU",
    "china": "CHN",
    "vietnam": "VNM",
    "viet nam": "VNM",
}


def normalize_name(name: str) -> str:
    return " ".join(str(name).strip().lower().split())


def map_country_name(name: str) -> str | None:
    return NAME_TO_ISO3.get(normalize_name(name))


def map_country_column(
    frame: pd.DataFrame,
    *,
    name_col: str = "country_name",
    iso_col: str = "iso3",
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """
    Attach iso3 from an explicit name map.

    Returns (mapped_frame with valid iso3 only, unmatched row reports).
    Rows that already have a valid 3-letter iso3 are kept as-is.
    """
    out = frame.copy()
    unmatched: list[dict[str, Any]] = []
    resolved: list[str | None] = []
    for index, row in out.iterrows():
        existing = row.get(iso_col)
        if isinstance(existing, str) and len(existing.strip()) == 3:
            resolved.append(existing.strip().upper())
            continue
        name = row.get(name_col)
        iso = map_country_name(str(name)) if name is not None else None
        if iso is None:
            unmatched.append(
                {
                    "row": int(index) if isinstance(index, int) else str(index),
                    "country_name": name,
                    "iso3": existing,
                },
            )
            resolved.append(None)
        else:
            resolved.append(iso)
    out[iso_col] = resolved
    matched = out[out[iso_col].notna()].copy()
    matched[iso_col] = matched[iso_col].astype(str)
    return matched, unmatched
