"""Export Phase 8 ranking golden (COL HS64 2023 IMSFE-style preset) from imsfe."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from imsfe.block_prep import prepare_block
from imsfe.config import (
    HsChaptersSettings,
    MissingDataSettings,
    Settings,
    VariableConfig,
    VariablesConfig,
    YearsSettings,
)
from imsfe.mcdm import score as mcdm_score
from imsfe.normalize import normalize_matrix
from imsfe.weights import LEGACY_FACTOR_MAP, Weights, weights_equal

from imsatlas_etl.paths import repo_root

# Mirrors core/src/presets/imsfeExpert2025.ts (ims-backtest v0.2.0).
_EXPERT_FACTOR_MEANS: dict[str, float] = {
    "COST": 0.21466666666666667,
    "LOGI": 0.18466666666666667,
    "COMM": 0.19333333333333333,
    "ECON": 0.15333333333333332,
    "POLI": 0.13066666666666665,
    "CULT": 0.12333333333333332,
}

_FACTORS = [
    "demand",
    "cost_access",
    "logistics",
    "competition",
    "product_fit",
    "macro_risk",
    "institutional",
    "openness_legacy",
    "sustainability",
]

# Compact IMS-like variable set for the browser demo / E2E.
# Includes open redistributable series used for SPEC §11 parity (FTA, CO2PC, PLI).
_VARS: list[tuple[str, str, str]] = [
    ("IMPV", "demand", "benefit"),
    ("IMPC", "demand", "benefit"),
    ("GRW", "demand", "benefit"),
    ("GDPPC", "demand", "benefit"),
    ("DIST", "cost_access", "cost"),
    ("TARIF", "cost_access", "cost"),
    ("FTA", "cost_access", "benefit"),
    ("PLI", "cost_access", "cost"),
    ("LPI", "logistics", "benefit"),
    ("HHI", "competition", "cost"),
    ("CULT", "product_fit", "cost"),
    ("LANG", "product_fit", "benefit"),
    ("INFL", "macro_risk", "cost"),
    ("UNEMP", "macro_risk", "cost"),
    ("GOV", "institutional", "benefit"),
    ("EOC", "openness_legacy", "benefit"),
    ("CO2PC", "sustainability", "cost"),
]


def _variable(vid: str, factor: str, direction: str) -> VariableConfig:
    """Build a VariableConfig, including atlas-only factors (e.g. sustainability).

    imsfe v0.2.0 FactorId omits sustainability; model_construct bypasses the
    pydantic literal so SPEC §11 demo variables can still be scored.
    """
    return VariableConfig.model_construct(
        id=vid,
        name=vid,
        factor=factor,
        direction=direction,
        source="synthetic",
        code=vid,
        transform="none",
        origin_specific=False,
        unit="",
        notes="",
    )


def _variables_config(
    variables: list[VariableConfig],
    *,
    factors: list[str] | None = None,
) -> VariablesConfig:
    present = sorted({str(v.factor) for v in variables})
    ordered = [f for f in (factors or _FACTORS) if f in present]
    for f in present:
        if f not in ordered:
            ordered.append(f)
    return VariablesConfig.model_construct(factors=ordered, variables=variables)


def _variables() -> VariablesConfig:
    variables = [_variable(vid, factor, direction) for vid, factor, direction in _VARS]
    return _variables_config(variables)


def _settings(policy: MissingDataSettings) -> Settings:
    return Settings(
        origins=["COL"],
        hs_chapters=HsChaptersSettings(primary="64"),
        years=YearsSettings(start=2012, end=2023),
        horizons=[1, 3],
        missing_data=policy,
    )


def _renorm(series: pd.Series) -> pd.Series:
    total = float(series.sum())
    if total <= 0:
        raise ValueError("cannot renormalise empty/zero weights")
    return series / total


def expert_weights_like_core(subset: VariablesConfig) -> Weights:
    """Port of core ``weightsExpertMean`` (wheel lacks weights_expert.yaml)."""
    factors_present = sorted({v.factor for v in subset.variables})
    mapped: dict[str, float] = {}
    unmapped: list[str] = []
    for f in factors_present:
        legacy = LEGACY_FACTOR_MAP.get(f)
        if legacy is not None and legacy in _EXPERT_FACTOR_MEANS:
            mapped[f] = _EXPERT_FACTOR_MEANS[legacy]
        else:
            unmapped.append(f)
    unmapped.sort()

    if mapped:
        mapped_series = _renorm(pd.Series(mapped, dtype=float))
        n_all = len(mapped) + len(unmapped)
        mapped_mass = len(mapped) / n_all
        unmapped_mass = 1.0 - mapped_mass
        fw = (mapped_series * mapped_mass).to_dict()
        if unmapped:
            share = unmapped_mass / len(unmapped)
            for f in unmapped:
                fw[f] = share
        factors = _renorm(pd.Series(fw, dtype=float))
    else:
        eq = weights_equal(subset)
        return Weights(
            factors=eq.factors,
            variables_within=eq.variables_within,
            scheme="expert_mean",
        )

    within: dict[str, pd.Series] = {}
    for factor in factors.index:
        vids = [v.id for v in subset.variables if v.factor == factor]
        if not vids:
            continue
        # Demo variable ids are not in the legacy expert spreadsheet → equal within.
        within[str(factor)] = pd.Series(
            {vid: 1.0 / len(vids) for vid in vids},
            dtype=float,
        )

    return Weights(
        factors=factors,
        variables_within=within,
        scheme="expert_mean",
    )


def build_col_hs64_block(*, seed: int = 64_2023) -> dict[str, Any]:
    """Synthesise a 60-destination COL/HS64/2023 block scored with imsfe WSM+expert."""
    rng = np.random.default_rng(seed)
    variables = _variables()
    columns = [v.id for v in variables.variables]
    directions = {v.id: v.direction for v in variables.variables}
    n = 60
    iso_pool = [
        "USA",
        "CHN",
        "DEU",
        "FRA",
        "GBR",
        "ITA",
        "ESP",
        "NLD",
        "BEL",
        "CHE",
        "AUT",
        "SWE",
        "NOR",
        "DNK",
        "FIN",
        "POL",
        "CZE",
        "PRT",
        "IRL",
        "GRC",
        "TUR",
        "RUS",
        "UKR",
        "BRA",
        "ARG",
        "MEX",
        "CHL",
        "PER",
        "ECU",
        "URY",
        "CAN",
        "JPN",
        "KOR",
        "IND",
        "IDN",
        "THA",
        "VNM",
        "MYS",
        "SGP",
        "AUS",
        "NZL",
        "ZAF",
        "EGY",
        "MAR",
        "NGA",
        "KEN",
        "SAU",
        "ARE",
        "ISR",
        "IRQ",
    ]
    while len(iso_pool) < n:
        iso_pool.append(f"X{len(iso_pool):02d}")
    candidates = iso_pool[:n]

    data: dict[str, Any] = {"iso3_d": candidates}
    for j, col in enumerate(columns):
        base = rng.normal(loc=8 + j * 0.3, scale=2.5, size=n)
        if directions[col] == "cost":
            base = np.abs(base) + 0.4
        miss = rng.random(n) < 0.05
        vals = base.astype(float)
        vals[miss] = np.nan
        data[col] = vals
    data["IMPV"] = np.abs(rng.normal(1e6, 3e5, size=n))

    frame = pd.DataFrame(data)
    policy = MissingDataSettings(
        max_missing_share=0.2,
        impute="median",
        min_candidates=20,
    )
    prep = prepare_block(frame, columns, settings=_settings(policy), missing=policy)
    used = prep.used_variables
    used_dirs = {c: directions[c] for c in used}
    subset_vars = [v for v in variables.variables if v.id in used]
    subset = _variables_config(subset_vars)

    w_equal = weights_equal(subset)
    w_expert = expert_weights_like_core(subset)

    normalized = normalize_matrix(prep.matrix, used_dirs, "minmax")  # type: ignore[arg-type]
    scores_expert = mcdm_score(
        prep.matrix,
        w_expert,
        used_dirs,  # type: ignore[arg-type]
        "wsm",
        normalized=normalized,
    )
    scores_equal = mcdm_score(
        prep.matrix,
        w_equal,
        used_dirs,  # type: ignore[arg-type]
        "wsm",
        normalized=normalized,
    )

    def ranking(scores: pd.Series) -> list[dict[str, Any]]:
        ordered = scores.sort_values(ascending=False)
        rows = []
        for rank, (iso, sc) in enumerate(ordered.items(), start=1):
            rows.append({"iso3": str(iso), "score": float(sc), "rank": rank})
        return rows

    factor_scores: dict[str, dict[str, float]] = {}
    for iso in prep.candidates:
        fs: dict[str, float] = {}
        for factor, vw in w_expert.variables_within.items():
            cols = [c for c in vw.index if c in normalized.columns]
            if not cols:
                continue
            w = vw.loc[cols].astype(float)
            w = w / w.sum()
            fs[str(factor)] = float(normalized.loc[iso, cols].mul(w).sum())
        factor_scores[str(iso)] = fs

    raw_indexed = frame.set_index("iso3_d")
    raw_rows = []
    for iso in prep.candidates:
        row: dict[str, float | None] = {"iso3": str(iso)}
        for col in columns:
            val = raw_indexed.loc[iso, col]
            row[col] = None if pd.isna(val) else float(val)
        raw_rows.append(row)

    return {
        "preset": "COL_HS64_2023_IMSFE",
        "origin": "COL",
        "hs": "64",
        "hs_name": {"en": "Footwear", "es": "Calzado"},
        "year": 2023,
        "normalization": "minmax",
        "mcdm": "wsm",
        "weight_scheme": "expert_mean",
        "missing_threshold": 0.2,
        "variables": [
            {"id": v.id, "factor": v.factor, "direction": v.direction}
            for v in variables.variables
        ],
        "candidates": [str(c) for c in prep.candidates],
        "used_variables": used,
        "excluded_variables": list(prep.excluded_variables),
        "n_imputed_cells": int(prep.n_imputed_cells),
        "raw": raw_rows,
        "prepared_matrix": [
            [float(x) for x in prep.matrix.loc[iso, used].to_numpy()]
            for iso in prep.candidates
        ],
        "imputed_mask": [
            [bool(x) for x in prep.imputed_mask.loc[iso, used].to_numpy()]
            for iso in prep.candidates
        ],
        "ranking_expert": ranking(scores_expert),
        "ranking_equal": ranking(scores_equal),
        "factor_scores": factor_scores,
        "weights_expert": {
            "factors": {str(k): float(v) for k, v in w_expert.factors.items()},
            "variables_within": {
                str(f): {str(k): float(v) for k, v in vw.items()}
                for f, vw in w_expert.variables_within.items()
            },
        },
    }


# BYOD / non-redistributable ids must never ship under app/public.
_PUBLIC_DROP_IDS = frozenset({"TARIF", "CULT"})


def default_output_paths() -> tuple[Path, Path, Path]:
    root = repo_root()
    return (
        root / "core" / "fixtures" / "phase8" / "golden.json",
        root / "app" / "e2e" / "fixtures" / "phase8_col_hs64_full.json",
        root / "app" / "public" / "meta" / "phase8_col_hs64.json",
    )


_APP_BLOCK_KEYS = (
    "preset",
    "origin",
    "hs",
    "hs_name",
    "year",
    "normalization",
    "mcdm",
    "weight_scheme",
    "missing_threshold",
    "variables",
    "candidates",
    "raw",
    "ranking_expert",
)


def slim_block_for_app(block: dict[str, Any]) -> dict[str, Any]:
    """Drop recomputable matrices from the browser demo payload."""
    return {k: block[k] for k in _APP_BLOCK_KEYS if k in block}


def _ranking_from_raw(
    candidates: list[str],
    variables: list[dict[str, Any]],
    raw_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Re-score a slim panel (same seed values) after dropping BYOD columns."""
    columns = [v["id"] for v in variables]
    directions = {v["id"]: v["direction"] for v in variables}
    frame = pd.DataFrame(
        [
            {
                "iso3_d": row["iso3"],
                **{
                    col: (np.nan if row.get(col) is None else float(row[col]))
                    for col in columns
                },
            }
            for row in raw_rows
        ],
    )
    # Preserve candidate order from the full block.
    frame = frame.set_index("iso3_d").loc[candidates].reset_index()
    policy = MissingDataSettings(
        max_missing_share=0.2,
        impute="median",
        min_candidates=20,
    )
    prep = prepare_block(frame, columns, settings=_settings(policy), missing=policy)
    used = prep.used_variables
    used_dirs = {c: directions[c] for c in used}
    subset_vars = [
        _variable(v["id"], v["factor"], v["direction"])
        for v in variables
        if v["id"] in used
    ]
    subset = _variables_config(subset_vars)
    w_expert = expert_weights_like_core(subset)
    normalized = normalize_matrix(prep.matrix, used_dirs, "minmax")  # type: ignore[arg-type]
    scores = mcdm_score(
        prep.matrix,
        w_expert,
        used_dirs,  # type: ignore[arg-type]
        "wsm",
        normalized=normalized,
    )
    ordered = scores.sort_values(ascending=False)
    return [
        {"iso3": str(iso), "score": float(sc), "rank": rank}
        for rank, (iso, sc) in enumerate(ordered.items(), start=1)
    ]


def slim_block_for_public(block: dict[str, Any]) -> dict[str, Any]:
    """Public demo: drop BYOD raw columns and recompute expert ranking."""
    slim = slim_block_for_app(block)
    variables = [v for v in slim["variables"] if v["id"] not in _PUBLIC_DROP_IDS]
    keep = {v["id"] for v in variables}
    raw = []
    for row in slim["raw"]:
        out: dict[str, Any] = {"iso3": row["iso3"]}
        for col in keep:
            out[col] = row.get(col)
        raw.append(out)
    ranking = _ranking_from_raw(list(slim["candidates"]), variables, raw)
    slim["variables"] = variables
    slim["raw"] = raw
    slim["ranking_expert"] = ranking
    slim["notes"] = [
        "Public demo without BYOD variables TARIF and CULT (gate: byod_only).",
        "Full ranking: app/e2e/fixtures/phase8_col_hs64_full.json",
    ]
    slim["excluded_byod"] = [
        {"id": "TARIF", "reason": "redistributable:false / byod_only"},
        {"id": "CULT", "reason": "redistributable:false / byod_only"},
    ]
    return slim


def write_phase8_goldens(path: Path | None = None) -> Path:
    block = build_col_hs64_block()
    full = {
        "spec": "phase8",
        "imsfe_source": "ims-backtest@v0.2.0",
        "tolerance": 1e-9,
        "block": block,
    }
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(full, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        return path
    core_path, e2e_path, public_path = default_output_paths()
    for p in (core_path, e2e_path, public_path):
        p.parent.mkdir(parents=True, exist_ok=True)
    core_path.write_text(
        json.dumps(full, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    e2e_payload = {
        "spec": "phase8",
        "imsfe_source": "ims-backtest@v0.2.0",
        "tolerance": 1e-9,
        "block": slim_block_for_app(block),
    }
    e2e_path.write_text(
        json.dumps(e2e_payload, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )
    public_payload = {
        "provenance": "phase10-fix public demo (no TARIF/CULT raw values)",
        "block": slim_block_for_public(block),
    }
    # Compact JSON for faster first ranking fetch.
    public_path.write_text(
        json.dumps(public_payload, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return core_path
