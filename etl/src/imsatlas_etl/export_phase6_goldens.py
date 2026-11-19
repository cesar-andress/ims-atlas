"""Export Phase 6 golden fixtures from ims-backtest for Vitest."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from imsfe.smaa import (
    dirichlet_concentration,
    rank_acceptability,
    ranks_from_scores,
    sample_box,
    sample_dirichlet,
    sample_hierarchical_weights,
)
from imsfe.validation.backtest import (
    baseline_scores,
    bootstrap_paired_deltas,
    make_split,
)
from imsfe.validation.metrics import (
    auc_ext,
    evaluate_ranking,
    ndcg_at_k,
    precision_at_k,
    spearman_corr,
)

from imsatlas_etl.paths import repo_root

# Statistical tolerance for Monte Carlo (TS Mulberry32 vs NumPy PCG64).
SMAA_ACCEPT_TOL = 0.05


def _series_dict(s: pd.Series) -> dict[str, float]:
    return {str(k): float(v) for k, v in s.items()}


def _build_metrics_cases(rng: np.random.Generator) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for i in range(8):
        n = 25 + i
        ids = [f"D{j:02d}" for j in range(n)]
        score = pd.Series(rng.normal(size=n), index=ids)
        y_int = pd.Series(rng.normal(size=n), index=ids)
        y_ext = pd.Series(rng.integers(0, 2, size=n).astype(float), index=ids)
        # Ensure both classes present
        y_ext.iloc[0] = 0.0
        y_ext.iloc[1] = 1.0
        mets = evaluate_ranking(score, y_int=y_int, y_ext=y_ext)
        cases.append(
            {
                "id": f"metrics_{i}",
                "score": _series_dict(score),
                "y_int": _series_dict(y_int),
                "y_ext": _series_dict(y_ext),
                "expected": {k: float(v) for k, v in mets.items()},
                "ndcg@10": float(ndcg_at_k(score, y_int, k=10)),
                "precision@10": float(precision_at_k(score, y_int, k=10)),
                "spearman": float(spearman_corr(score, y_int)),
                "auc": float(auc_ext(score, y_ext)),
            },
        )
    return cases


def _build_split_cases() -> list[dict[str, Any]]:
    years = list(range(2012, 2024))
    cases = []
    for horizon in (1, 3):
        split = make_split(years, first_test_year=2018, horizon=horizon)
        cases.append(
            {
                "years": years,
                "first_test_year": 2018,
                "horizon": horizon,
                "train": list(split.train_feature_years),
                "test": list(split.test_feature_years),
            },
        )
    return cases


def _build_smaa_case(rng: np.random.Generator) -> dict[str, Any]:
    n_alt = 60
    n_crit = 6
    alts = [f"C{i:02d}" for i in range(n_alt)]
    crit = [f"V{j}" for j in range(n_crit)]
    # Pre-normalised matrix on [0, 10]
    N = rng.uniform(0, 10, size=(n_alt, n_crit))
    # Simple two-factor hierarchy
    factor_names = ["f0", "f1"]
    factor_mu = np.array([0.55, 0.45])
    factor_sigma = np.array([0.08, 0.07])
    factor_min = np.array([0.3, 0.2])
    factor_max = np.array([0.8, 0.7])
    within = {
        "f0": {
            "names": np.array(crit[:3], dtype=object),
            "mu": np.array([0.4, 0.35, 0.25]),
            "sigma": np.array([0.1, 0.09, 0.08]),
            "min": np.array([0.1, 0.1, 0.05]),
            "max": np.array([0.7, 0.6, 0.5]),
        },
        "f1": {
            "names": np.array(crit[3:], dtype=object),
            "mu": np.array([0.5, 0.3, 0.2]),
            "sigma": np.array([0.12, 0.1, 0.09]),
            "min": np.array([0.1, 0.05, 0.05]),
            "max": np.array([0.8, 0.6, 0.5]),
        },
    }
    from imsfe.smaa import ExpertWeightStats

    stats = ExpertWeightStats(
        factor_names=factor_names,
        factor_mu=factor_mu,
        factor_sigma=factor_sigma,
        factor_min=factor_min,
        factor_max=factor_max,
        within=within,
    )
    n_samples = 2000
    seed = 42
    py_rng = np.random.default_rng(seed)
    W, names = sample_hierarchical_weights(
        stats,
        n_samples,
        py_rng,
        mode="dirichlet",
        dispersion_scale=1.0,
        columns=crit,
    )
    scores = N @ W.T
    ranks = ranks_from_scores(scores)
    accept = rank_acceptability(ranks)
    kappa = dirichlet_concentration(factor_mu, factor_sigma)

    # Also export a small exact weight-sample probe (first 50) for 1e-9 WSM path
    W50 = W[:50]
    scores50 = N @ W50.T
    ranks50 = ranks_from_scores(scores50)

    return {
        "n_alt": n_alt,
        "alternatives": alts,
        "columns": crit,
        "normalized": N.tolist(),
        "stats": {
            "factorNames": factor_names,
            "factorMu": factor_mu.tolist(),
            "factorSigma": factor_sigma.tolist(),
            "factorMin": factor_min.tolist(),
            "factorMax": factor_max.tolist(),
            "within": {
                "f0": {
                    "names": crit[:3],
                    "mu": [0.4, 0.35, 0.25],
                    "sigma": [0.1, 0.09, 0.08],
                    "min": [0.1, 0.1, 0.05],
                    "max": [0.7, 0.6, 0.5],
                },
                "f1": {
                    "names": crit[3:],
                    "mu": [0.5, 0.3, 0.2],
                    "sigma": [0.12, 0.1, 0.09],
                    "min": [0.1, 0.05, 0.05],
                    "max": [0.8, 0.6, 0.5],
                },
            },
        },
        "seed": seed,
        "n_samples": n_samples,
        "mode": "dirichlet",
        "kappa": float(kappa),
        "weight_samples_50": W50.tolist(),
        "weight_names": names,
        "scores_50": scores50.tolist(),
        "ranks_50": ranks50.tolist(),
        "acceptability": accept.tolist(),
        "p_top_3": (ranks <= 3).mean(axis=1).tolist(),
        "central_weights": (W.mean(axis=0) / W.mean(axis=0).sum()).tolist(),
        "accept_tol": SMAA_ACCEPT_TOL,
        "box_sample_3": sample_box(
            factor_min,
            factor_max,
            3,
            np.random.default_rng(7),
        ).tolist(),
        "dirichlet_sample_3": sample_dirichlet(
            factor_mu,
            factor_sigma,
            3,
            np.random.default_rng(7),
        ).tolist(),
    }


def _build_bootstrap_case(rng: np.random.Generator) -> dict[str, Any]:
    rows = []
    methods = ["ims_wsm", "import_volume", "gravity", "random"]
    for oi, origin in enumerate(["COL", "PER", "MEX", "CHL", "BRA"]):
        for year in range(2018, 2022):
            for method in methods:
                base = 0.4 + 0.05 * oi + 0.01 * (year - 2018)
                noise = float(rng.normal(0, 0.03))
                bump = 0.08 if method == "ims_wsm" else 0.0
                rows.append(
                    {
                        "origin": origin,
                        "year": year,
                        "method": method,
                        "family": "ims" if method == "ims_wsm" else "baseline",
                        "target": "intensive",
                        "horizon": 1,
                        "ndcg@10": base + bump + noise,
                    },
                )
    df = pd.DataFrame(rows)
    # Long form for bootstrap_paired_deltas expects metric column
    paired = bootstrap_paired_deltas(
        df,
        methods=["ims_wsm"],
        baselines=("import_volume", "gravity", "random"),
        metric="ndcg@10",
        n_reps=500,
        seed=42,
    )
    # Observed means (deterministic part)
    observed = []
    for method in methods:
        sub = df.loc[df["method"] == method, "ndcg@10"]
        observed.append({"method": method, "mean": float(sub.mean())})
    return {
        "rows": rows,
        "observed_means": observed,
        "paired": paired.to_dict(orient="records"),
        "n_reps": 500,
        "seed": 42,
    }


def build_golden_payload() -> dict[str, Any]:
    rng = np.random.default_rng(123)
    return {
        "spec": "phase6",
        "imsfe_source": "ims-backtest@v0.2.0",
        "tolerance_exact": 1e-9,
        "smaa_accept_tol": SMAA_ACCEPT_TOL,
        "metrics": _build_metrics_cases(rng),
        "splits": _build_split_cases(),
        "baselines": _build_baseline_case(rng),
        "smaa": _build_smaa_case(rng),
        "bootstrap": _build_bootstrap_case(rng),
    }


def _build_baseline_case(rng: np.random.Generator) -> dict[str, Any]:
    n = 30
    ids = [f"C{i:02d}" for i in range(n)]
    group = pd.DataFrame(
        {
            "iso3_d": ids,
            "IMPV": rng.uniform(1e5, 1e7, size=n),
        },
    )
    imp = baseline_scores(group, "import_volume")
    py_rng = np.random.default_rng(0)
    rnd = baseline_scores(group, "random", rng=py_rng)
    gravity = pd.Series(rng.normal(size=n), index=ids)
    return {
        "candidates": ids,
        "import_volume_raw": _series_dict(pd.Series(group["IMPV"].values, index=ids)),
        "import_volume_scores": _series_dict(imp),
        "gravity_scores": _series_dict(gravity),
        "random_seed0": _series_dict(rnd),
    }


def default_output_path() -> Path:
    return repo_root() / "core" / "fixtures" / "phase6" / "golden.json"


def write_phase6_goldens(path: Path | None = None) -> Path:
    target = path or default_output_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = build_golden_payload()
    target.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return target
