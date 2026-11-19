"""Phase Z: Python transform pipeline matches documented goldens @ 1e-9."""

from __future__ import annotations

import math

from imsatlas_etl.normalize_lab import run_column_pipeline, scale_benefit

TOL = 1e-9


def _close(a: float, b: float) -> bool:
    if math.isnan(a) and math.isnan(b):
        return True
    return abs(a - b) <= TOL


def test_minmax_benefit_and_cost_direction_after() -> None:
    series = [1.0, 2.0, 10.0]
    benefit = run_column_pipeline(
        series,
        skew="none",
        outlier="none",
        scale="minmax",
        direction="benefit",
    )
    cost = run_column_pipeline(
        series,
        skew="none",
        outlier="none",
        scale="minmax",
        direction="cost",
    )
    bv = benefit["values"]
    cv = cost["values"]
    assert isinstance(bv, list) and isinstance(cv, list)
    assert _close(bv[2], 10.0)
    assert _close(cv[2], 0.0)
    assert _close(cv[0], 10.0)


def test_robust_z_constant_column() -> None:
    out = scale_benefit([3.0, 3.0, 3.0], "robust_z")
    assert out == [0.0, 0.0, 0.0]


def test_log1p_and_missing() -> None:
    from imsatlas_etl.normalize_lab import apply_skew

    skewed = apply_skew([1.0, None, -2.0], "log1p")
    assert _close(skewed[0], math.log1p(1.0))
    assert math.isnan(skewed[1])
    assert math.isnan(skewed[2])


def test_winsor_flags_extreme() -> None:
    from imsatlas_etl.normalize_lab import winsorize

    series = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 100.0]
    values, flags = winsorize(series, "winsor_1_99")
    assert flags[-1] is True
    assert values[-1] < 100.0
