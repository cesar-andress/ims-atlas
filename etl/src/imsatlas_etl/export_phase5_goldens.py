"""Export Phase 5 golden fixtures from ims-backtest (imsfe) for Vitest @ 1e-9."""

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
from imsfe.weights import Weights, get_weights, weights_equal

from imsatlas_etl.paths import repo_root

NORMALIZATIONS = ["minmax", "ratio_legacy", "zscore", "rank", "log_minmax"]
MCDM = ["wsm", "topsis", "vikor", "promethee_ii"]
WEIGHT_SCHEMES = ["equal", "entropy", "critic"]

# Minimal catalog covering all SPEC factors required by VariablesConfig.
_FACTORS = [
    "demand",
    "cost_access",
    "logistics",
    "competition",
    "product_fit",
    "macro_risk",
    "institutional",
    "openness_legacy",
]


def _mini_variables() -> VariablesConfig:
    specs = [
        ("V_DEM_A", "demand", "benefit"),
        ("V_DEM_B", "demand", "benefit"),
        ("V_COST", "cost_access", "cost"),
        ("V_LOGI", "logistics", "benefit"),
        ("V_COMM", "competition", "cost"),
        ("V_FIT", "product_fit", "benefit"),
        ("V_MACRO", "macro_risk", "cost"),
        ("V_INST", "institutional", "benefit"),
        ("V_OPEN", "openness_legacy", "benefit"),
    ]
    variables = [
        VariableConfig(
            id=vid,
            name=vid,
            factor=factor,  # type: ignore[arg-type]
            direction=direction,  # type: ignore[arg-type]
            source="synthetic",
            code=vid,
            transform="none",
            origin_specific=False,
        )
        for vid, factor, direction in specs
    ]
    return VariablesConfig(factors=list(_FACTORS), variables=variables)  # type: ignore[arg-type]


def _make_block(
    *,
    seed: int,
    n: int,
    columns: list[str],
    missing_rate: float,
) -> tuple[pd.DataFrame, list[str]]:
    rng = np.random.default_rng(seed)
    iso = [f"C{i:02d}" for i in range(n)]
    data: dict[str, Any] = {"iso3_d": iso}
    for j, col in enumerate(columns):
        # Mix scales / signs so cost/benefit and ratio guards are exercised.
        base = rng.normal(loc=10 + j, scale=3.0, size=n)
        if (
            col.startswith("V_COST")
            or col.startswith("V_COMM")
            or col.startswith(
                "V_MACRO",
            )
        ):
            base = np.abs(base) + 0.5
        data[col] = base
    frame = pd.DataFrame(data)
    # Inject missing cells (never entire column above threshold for most vars).
    n_miss = int(round(missing_rate * n * len(columns)))
    for _ in range(n_miss):
        i = int(rng.integers(0, n))
        j = int(rng.integers(0, len(columns)))
        frame.loc[i, columns[j]] = np.nan
    # One column with high missing to trigger exclusion in some blocks.
    if seed % 3 == 0:
        high = columns[-1]
        for i in range(int(0.35 * n)):
            frame.loc[i, high] = np.nan
    return frame, iso


def _series_to_list(s: pd.Series) -> list[float]:
    return [float(x) for x in s.to_numpy(dtype=float)]


def _matrix_to_list(df: pd.DataFrame) -> list[list[float]]:
    return [[float(x) for x in row] for row in df.to_numpy(dtype=float)]


def build_golden_payload(*, n_blocks: int = 10) -> dict[str, Any]:
    variables = _mini_variables()
    columns = [v.id for v in variables.variables]
    directions = {v.id: v.direction for v in variables.variables}
    policy = MissingDataSettings(
        max_missing_share=0.2,
        impute="median",
        min_candidates=20,
    )
    # Avoid imsfe.config_dir() (broken for installed wheels); pass Settings explicitly.
    settings = Settings(
        origins=["COL"],
        hs_chapters=HsChaptersSettings(primary="64"),
        years=YearsSettings(start=2012, end=2023),
        horizons=[1, 3],
        missing_data=policy,
    )

    blocks: list[dict[str, Any]] = []
    for b in range(n_blocks):
        seed = 1000 + b * 17
        raw, iso = _make_block(
            seed=seed,
            n=22 + (b % 3),
            columns=columns,
            missing_rate=0.04,
        )
        prep = prepare_block(raw, columns, settings=settings, missing=policy)
        used = prep.used_variables
        used_dirs = {c: directions[c] for c in used}
        used_vars = [v for v in variables.variables if v.id in used]
        # Restrict VariablesConfig view for hierarchical lift
        subset = VariablesConfig(
            factors=list(_FACTORS),  # type: ignore[arg-type]
            variables=used_vars,
        )

        norms: dict[str, list[list[float]]] = {}
        for method in NORMALIZATIONS:
            norms[method] = _matrix_to_list(
                normalize_matrix(prep.matrix, used_dirs, method),  # type: ignore[arg-type]
            )

        weight_payloads: dict[str, Any] = {}
        for scheme in WEIGHT_SCHEMES:
            if scheme == "equal":
                w = weights_equal(subset)
            else:
                w = get_weights(
                    scheme,  # type: ignore[arg-type]
                    subset,
                    matrix=prep.matrix,
                    directions=used_dirs,
                )
            weight_payloads[scheme] = {
                "factors": {str(k): float(v) for k, v in w.factors.items()},
                "variables_within": {
                    str(f): {str(k): float(v) for k, v in vw.items()}
                    for f, vw in w.variables_within.items()
                },
                "flat": {str(k): float(v) for k, v in w.flat(used).items()},
            }

        scores: dict[str, Any] = {}
        for scheme in WEIGHT_SCHEMES:
            wdict = weight_payloads[scheme]
            w = Weights(
                factors=pd.Series(wdict["factors"], dtype=float),
                variables_within={
                    f: pd.Series(vw, dtype=float)
                    for f, vw in wdict["variables_within"].items()
                },
                scheme=scheme,
            )
            for method in MCDM:
                for norm_id in ("minmax", "zscore"):
                    key = f"{scheme}|{norm_id}|{method}"
                    norm_df = pd.DataFrame(
                        norms[norm_id],
                        index=prep.matrix.index,
                        columns=used,
                    )
                    s = mcdm_score(
                        prep.matrix,
                        w,
                        used_dirs,  # type: ignore[arg-type]
                        method,  # type: ignore[arg-type]
                        normalized=norm_df,
                    )
                    scores[key] = _series_to_list(s)

        raw_indexed = raw.drop_duplicates("iso3_d", keep="first").set_index("iso3_d")
        raw_rows: list[list[float | None]] = []
        for iso3 in prep.candidates:
            row: list[float | None] = []
            for col in columns:
                val = raw_indexed.loc[iso3, col]
                if pd.isna(val):
                    row.append(None)
                else:
                    row.append(float(val))
            raw_rows.append(row)

        blocks.append(
            {
                "id": f"block_{b:02d}",
                "seed": seed,
                "candidates": list(prep.candidates),
                "columns": columns,
                "directions": directions,
                "raw": raw_rows,
                "prepared": {
                    "used_variables": used,
                    "excluded_variables": list(prep.excluded_variables),
                    "matrix": _matrix_to_list(prep.matrix),
                    "n_imputed_cells": int(prep.n_imputed_cells),
                    "imputed_mask": [
                        [bool(x) for x in row] for row in prep.imputed_mask.to_numpy()
                    ],
                },
                "normalized": norms,
                "weights": weight_payloads,
                "scores": scores,
            },
        )

    return {
        "spec": "phase5",
        "imsfe_source": "ims-backtest@v0.2.0",
        "tolerance": 1e-9,
        "variables": [
            {"id": v.id, "factor": v.factor, "direction": v.direction}
            for v in variables.variables
        ],
        "blocks": blocks,
    }


def default_output_path() -> Path:
    return repo_root() / "core" / "fixtures" / "phase5" / "golden.json"


def write_phase5_goldens(path: Path | None = None) -> Path:
    target = path or default_output_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = build_golden_payload()
    target.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return target
