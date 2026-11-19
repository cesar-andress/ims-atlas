"""Phase Z transform pipeline (Python mirror of core/src/transformPipeline.ts)."""

from __future__ import annotations

import math
from typing import Literal

Skew = Literal["none", "log", "log1p"]
Outlier = Literal["none", "winsor_1_99", "winsor_5_95"]
Scale = Literal["ratio", "minmax", "zscore", "robust_z", "rank"]
Direction = Literal["benefit", "cost"]

MAD_SCALE = 1.4826


def _finite(xs: list[float]) -> list[float]:
    return [x for x in xs if math.isfinite(x)]


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else float("nan")


def _median(xs: list[float]) -> float:
    if not xs:
        return float("nan")
    s = sorted(xs)
    n = len(s)
    mid = n // 2
    if n % 2:
        return s[mid]
    return (s[mid - 1] + s[mid]) / 2


def _std_sample(xs: list[float]) -> float:
    if len(xs) <= 1:
        return 0.0
    mu = _mean(xs)
    return math.sqrt(sum((x - mu) ** 2 for x in xs) / (len(xs) - 1))


def _quantile(sorted_xs: list[float], q: float) -> float:
    if not sorted_xs:
        return float("nan")
    if len(sorted_xs) == 1:
        return sorted_xs[0]
    pos = (len(sorted_xs) - 1) * q
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return sorted_xs[lo]
    w = pos - lo
    return sorted_xs[lo] * (1 - w) + sorted_xs[hi] * w


def apply_skew(series: list[float | None], skew: Skew) -> list[float]:
    out: list[float] = []
    for x in series:
        if x is None or not math.isfinite(x):
            out.append(float("nan"))
            continue
        if skew == "none":
            out.append(float(x))
        elif skew == "log":
            out.append(math.log(x) if x > 0 else float("nan"))
        else:
            out.append(math.log1p(x) if x > -1 else float("nan"))
    return out


def winsorize(
    series: list[float],
    treatment: Outlier,
) -> tuple[list[float], list[bool]]:
    flags = [False] * len(series)
    if treatment == "none":
        return list(series), flags
    finite = sorted(_finite(series))
    if not finite:
        return list(series), flags
    lo_q, hi_q = (0.01, 0.99) if treatment == "winsor_1_99" else (0.05, 0.95)
    lo = _quantile(finite, lo_q)
    hi = _quantile(finite, hi_q)
    out: list[float] = []
    for i, v in enumerate(series):
        if not math.isfinite(v):
            out.append(float("nan"))
            continue
        if v < lo:
            flags[i] = True
            out.append(lo)
        elif v > hi:
            flags[i] = True
            out.append(hi)
        else:
            out.append(v)
    return out, flags


def scale_benefit(
    series: list[float], method: Scale, scale_max: float = 10.0
) -> list[float]:
    finite = _finite(series)
    scale = scale_max if scale_max > 0 else 10.0
    if method == "ratio":
        if not finite:
            return [float("nan") for _ in series]
        vmax = max(finite)
        if vmax == 0:
            return [0.0 if math.isfinite(v) else float("nan") for v in series]
        return [
            (v / vmax) * scale if math.isfinite(v) else float("nan") for v in series
        ]
    if method == "minmax":
        if not finite:
            return [float("nan") for _ in series]
        vmin, vmax = min(finite), max(finite)
        span = vmax - vmin
        if span == 0:
            return [scale / 2 if math.isfinite(v) else float("nan") for v in series]
        return [
            ((v - vmin) / span) * scale if math.isfinite(v) else float("nan")
            for v in series
        ]
    if method == "zscore":
        if not finite:
            return [float("nan") for _ in series]
        mu = _mean(finite)
        sigma = _std_sample(finite)
        return [
            0.0
            if math.isfinite(v) and sigma == 0
            else ((v - mu) / sigma if math.isfinite(v) else float("nan"))
            for v in series
        ]
    if method == "robust_z":
        if not finite:
            return [float("nan") for _ in series]
        med = _median(finite)
        mad = _median([abs(v - med) for v in finite])
        denom = 0.0 if mad == 0 else mad * MAD_SCALE
        return [
            0.0
            if math.isfinite(v) and denom == 0
            else ((v - med) / denom if math.isfinite(v) else float("nan"))
            for v in series
        ]
    # rank
    indexed = [(i, v) for i, v in enumerate(series) if math.isfinite(v)]
    indexed.sort(key=lambda t: t[1])
    n = len(indexed)
    out = [float("nan")] * len(series)
    if n == 0:
        return out
    i = 0
    while i < n:
        j = i
        while j + 1 < n and indexed[j + 1][1] == indexed[i][1]:
            j += 1
        rank = (i + 1 + (j + 1)) / 2
        for k in range(i, j + 1):
            out[indexed[k][0]] = (rank / n) * scale
        i = j + 1
    return out


def apply_direction(
    scaled: list[float],
    direction: Direction,
    method: Scale,
    scale_max: float = 10.0,
) -> list[float]:
    if direction == "benefit":
        return list(scaled)
    scale = scale_max if scale_max > 0 else 10.0
    if method in ("zscore", "robust_z"):
        return [-v if math.isfinite(v) else float("nan") for v in scaled]
    return [scale - v if math.isfinite(v) else float("nan") for v in scaled]


def run_column_pipeline(
    series: list[float | None],
    *,
    skew: Skew = "none",
    outlier: Outlier = "none",
    scale: Scale = "minmax",
    direction: Direction = "benefit",
    scale_max: float = 10.0,
) -> dict[str, object]:
    values = apply_skew(series, skew)
    values, flags = winsorize(values, outlier)
    values = scale_benefit(values, scale, scale_max)
    values = apply_direction(values, direction, scale, scale_max)
    return {"values": values, "winsor_flags": flags}
