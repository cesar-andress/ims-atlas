/**
 * Phase A5 — explicit imputation methods (never silent).
 * Time-t imputations use only observations with year <= t.
 */

export type ImputationMethodId =
  "none" | "locf" | "linear_interp" | "log_linear_trend" | "cross_section";

export type SeriesPoint = { year: number; value: number | null };

export type ImputationResult = {
  value: number;
  method: ImputationMethodId;
  /** Years used as inputs (all <= targetYear). */
  inputYears: number[];
  /** Optional interval [lo, hi]. */
  interval?: [number, number];
  ageYears?: number;
};

function observedAtOrBefore(
  series: readonly SeriesPoint[],
  asOfYear: number,
): { year: number; value: number }[] {
  return series
    .filter(
      (p) =>
        p.year <= asOfYear && p.value !== null && Number.isFinite(p.value as number),
    )
    .map((p) => ({ year: p.year, value: p.value as number }))
    .sort((a, b) => a.year - b.year);
}

/** Last observation carried forward (only past/present vs asOfYear). */
export function imputeLocf(
  series: readonly SeriesPoint[],
  targetYear: number,
  asOfYear: number = targetYear,
): ImputationResult | null {
  if (targetYear > asOfYear) return null;
  const obs = observedAtOrBefore(series, asOfYear).filter((p) => p.year <= targetYear);
  if (obs.length === 0) return null;
  const last = obs[obs.length - 1]!;
  return {
    value: last.value,
    method: "locf",
    inputYears: [last.year],
    ageYears: targetYear - last.year,
  };
}

/**
 * Linear interpolation inside the observed range.
 * Brackets may use years <= asOfYear; cell year is targetYear.
 */
export function imputeLinearInterp(
  series: readonly SeriesPoint[],
  targetYear: number,
  asOfYear: number = targetYear,
): ImputationResult | null {
  if (targetYear > asOfYear) return null;
  const obs = observedAtOrBefore(series, asOfYear);
  if (obs.length < 2) return null;
  const exact = obs.find((p) => p.year === targetYear);
  if (exact) {
    return {
      value: exact.value,
      method: "linear_interp",
      inputYears: [exact.year],
    };
  }
  for (let i = 0; i < obs.length - 1; i++) {
    const a = obs[i]!;
    const b = obs[i + 1]!;
    if (a.year < targetYear && targetYear < b.year) {
      const w = (targetYear - a.year) / (b.year - a.year);
      const value = a.value + w * (b.value - a.value);
      return {
        value,
        method: "linear_interp",
        inputYears: [a.year, b.year],
      };
    }
  }
  return null;
}

/** Log-linear trend on years <= asOfYear; predict targetYear. */
export function imputeLogLinearTrend(
  series: readonly SeriesPoint[],
  targetYear: number,
  asOfYear: number = targetYear,
): ImputationResult | null {
  if (targetYear > asOfYear) return null;
  const obs = observedAtOrBefore(series, asOfYear).filter((p) => p.value > 0);
  if (obs.length < 2) return null;
  const xs = obs.map((p) => p.year);
  const ys = obs.map((p) => Math.log(p.value));
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  const logPred = intercept + slope * targetYear;
  const value = Math.exp(logPred);
  // crude residual SE for interval
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const fit = intercept + slope * xs[i]!;
    ss += (ys[i]! - fit) ** 2;
  }
  const se = Math.sqrt(ss / Math.max(1, n - 2));
  return {
    value,
    method: "log_linear_trend",
    inputYears: obs.map((p) => p.year),
    interval: [Math.exp(logPred - 1.96 * se), Math.exp(logPred + 1.96 * se)],
  };
}

export type CrossSectionRow = {
  iso3: string;
  y: number | null;
  /** Predictors for the same year (e.g. GDPPC, region dummy already numeric). */
  x: number[];
};

/**
 * Simple OLS cross-section for missing y using predictors of the same year.
 * Returns prediction ± 1.96 * residual SE when possible.
 */
export function imputeCrossSection(
  rows: readonly CrossSectionRow[],
  targetIso3: string,
): ImputationResult | null {
  const target = rows.find((r) => r.iso3 === targetIso3);
  if (!target || target.x.some((v) => !Number.isFinite(v))) return null;
  const train = rows.filter(
    (r) =>
      r.iso3 !== targetIso3 &&
      r.y !== null &&
      Number.isFinite(r.y as number) &&
      r.x.every((v) => Number.isFinite(v)) &&
      r.x.length === target.x.length,
  );
  if (train.length < target.x.length + 2) return null;
  const p = target.x.length;
  // Design matrix with intercept
  const xtx: number[][] = Array.from({ length: p + 1 }, () => Array(p + 1).fill(0));
  const xty: number[] = Array(p + 1).fill(0);
  for (const r of train) {
    const row = [1, ...r.x];
    for (let i = 0; i < p + 1; i++) {
      xty[i]! += row[i]! * (r.y as number);
      for (let j = 0; j < p + 1; j++) {
        xtx[i]![j]! += row[i]! * row[j]!;
      }
    }
  }
  const beta = solveLinear(xtx, xty);
  if (!beta) return null;
  const xRow = [1, ...target.x];
  let pred = 0;
  for (let i = 0; i < beta.length; i++) pred += beta[i]! * xRow[i]!;
  let ss = 0;
  for (const r of train) {
    const row = [1, ...r.x];
    let fit = 0;
    for (let i = 0; i < beta.length; i++) fit += beta[i]! * row[i]!;
    ss += ((r.y as number) - fit) ** 2;
  }
  const se = Math.sqrt(ss / Math.max(1, train.length - beta.length));
  return {
    value: pred,
    method: "cross_section",
    inputYears: [],
    interval: [pred - 1.96 * se, pred + 1.96 * se],
  };
}

function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const div = m[col]![col]!;
    for (let j = col; j <= n; j++) m[col]![j]! /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]!;
      for (let j = col; j <= n; j++) m[r]![j]! -= f * m[col]![j]!;
    }
  }
  return m.map((row) => row[n]!);
}

export type HoldoutEval = {
  method: ImputationMethodId;
  n: number;
  mae: number;
  mape: number;
};

/** Mask known points and score each method (no leakage: only year <= t). */
export function evaluateImputationHoldout(
  series: readonly SeriesPoint[],
  methods: readonly ImputationMethodId[] = [
    "locf",
    "linear_interp",
    "log_linear_trend",
  ],
): HoldoutEval[] {
  const known = series.filter(
    (p) => p.value !== null && Number.isFinite(p.value as number),
  );
  const out: HoldoutEval[] = [];
  for (const method of methods) {
    if (method === "none" || method === "cross_section") continue;
    const errs: number[] = [];
    const apes: number[] = [];
    for (const hold of known) {
      const masked = series.map((p) =>
        p.year === hold.year ? { ...p, value: null } : p,
      );
      let pred: ImputationResult | null = null;
      if (method === "locf") pred = imputeLocf(masked, hold.year);
      else if (method === "linear_interp") {
        pred = imputeLinearInterp(masked, hold.year);
      } else if (method === "log_linear_trend") {
        pred = imputeLogLinearTrend(masked, hold.year);
      }
      if (!pred) continue;
      const truth = hold.value as number;
      errs.push(Math.abs(pred.value - truth));
      if (truth !== 0) apes.push(Math.abs((pred.value - truth) / truth));
    }
    if (errs.length === 0) continue;
    out.push({
      method,
      n: errs.length,
      mae: errs.reduce((a, b) => a + b, 0) / errs.length,
      mape:
        apes.length === 0
          ? Number.NaN
          : (apes.reduce((a, b) => a + b, 0) / apes.length) * 100,
    });
  }
  return out.sort((a, b) => a.mae - b.mae);
}

/** Prefer the hold-out winner; default none. */
export function recommendImputationMethod(
  series: readonly SeriesPoint[],
): ImputationMethodId {
  const evals = evaluateImputationHoldout(series);
  return evals[0]?.method ?? "none";
}
