"""Coverage heatmaps (countries × years) per variable: CSV + PNG."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from imsatlas_etl.pipeline.io_paths import curated_dir, status_root

NEW_VARIABLE_IDS = (
    "ITU_IDI",
    "EF_EPI",
    "ODIN",
    "GEDI",
    "GII",
    "STARTUPBLINK",
    "EPI",
    "CO2PC",
    "PLI",
)


def coverage_matrix(frame: pd.DataFrame, value_col: str) -> pd.DataFrame:
    """Pivot presence (1=non-null value) by iso3 × year."""
    sub = frame[["iso3", "year", value_col]].copy()
    sub["present"] = sub[value_col].notna().astype(int)
    mat = sub.pivot_table(
        index="iso3",
        columns="year",
        values="present",
        aggfunc="max",
        fill_value=0,
    )
    mat = mat.reindex(sorted(mat.columns), axis=1)
    return mat.sort_index()


def write_heatmap_png(matrix: pd.DataFrame, path: Path, *, title: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if matrix.empty:
        fig, ax = plt.subplots(figsize=(4, 2))
        ax.text(0.5, 0.5, "no data", ha="center", va="center")
        ax.axis("off")
        fig.savefig(path, dpi=120, bbox_inches="tight")
        plt.close(fig)
        return
    data = matrix.to_numpy(dtype=float)
    fig_w = max(4.0, 0.45 * data.shape[1] + 1.5)
    fig_h = max(2.5, 0.35 * data.shape[0] + 1.0)
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    im = ax.imshow(
        data,
        aspect="auto",
        cmap="Greens",
        vmin=0,
        vmax=1,
        interpolation="nearest",
    )
    ax.set_xticks(np.arange(data.shape[1]))
    ax.set_xticklabels([str(c) for c in matrix.columns], rotation=90, fontsize=8)
    ax.set_yticks(np.arange(data.shape[0]))
    ax.set_yticklabels(list(matrix.index), fontsize=8)
    ax.set_title(title, fontsize=10)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


def run_coverage_reports(
    *,
    root: Path | None = None,
    variable_ids: tuple[str, ...] | None = None,
) -> dict[str, Any]:
    ids = list(variable_ids) if variable_ids else list(NEW_VARIABLE_IDS)
    vars_path = curated_dir(root=root) / "variables_country_year.parquet"
    if not vars_path.is_file():
        raise FileNotFoundError(
            f"missing {vars_path}; run transform (Phase 3 variables) first",
        )
    frame = pd.read_parquet(vars_path)
    out_dir = status_root(root=root) / "coverage"
    out_dir.mkdir(parents=True, exist_ok=True)
    reports: list[dict[str, Any]] = []
    for vid in ids:
        if vid not in frame.columns:
            reports.append(
                {
                    "variable": vid,
                    "status": "missing_column",
                    "n_countries": 0,
                    "n_years": 0,
                },
            )
            continue
        mat = coverage_matrix(frame, vid)
        csv_path = out_dir / f"{vid}_coverage.csv"
        png_path = out_dir / f"{vid}_coverage.png"
        mat.to_csv(csv_path)
        write_heatmap_png(mat, png_path, title=f"{vid} coverage")
        n_present = int((mat.to_numpy() == 1).sum())
        reports.append(
            {
                "variable": vid,
                "status": "ok",
                "n_countries": int(mat.shape[0]),
                "n_years": int(mat.shape[1]),
                "n_cells_present": n_present,
                "csv": str(csv_path),
                "png": str(png_path),
            },
        )
    return {"out_dir": str(out_dir), "reports": reports}
