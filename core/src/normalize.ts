/**
 * Cross-section normalisation (ports ``imsfe.normalize``, SPEC §5).
 * Scale targets match ims-backtest: [0, 10] for minmax/ratio/rank; z-score unbounded.
 */

import {
  finiteValues,
  isFiniteNumber,
  mean,
  median,
  rankAverage,
  stdSample,
} from "./math.js";
import type { Direction, NormalizationId } from "./types.js";

const CONSTANT_MID_10 = 5.0;
const MAD_SCALE = 1.4826;

/**
 * IMSFE ratio standardisation (DMP / IMP).
 * DMP (benefit): scaleMax * x / max; IMP (cost): scaleMax * min / x
 * (non-positive cost → NaN). ``scaleMax`` is 10 for IMSFE 2025, 5 for SMI 2018.
 */
export function normalizeRatioLegacy(
  series: readonly (number | null)[],
  direction: Direction,
  scaleMax = 10,
): number[] {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  const scale = scaleMax > 0 ? scaleMax : 10;
  if (direction === "benefit") {
    const finite = finiteValues(vals);
    const vmax = finite.length ? Math.max(...finite) : Number.NaN;
    if (!Number.isFinite(vmax) || vmax === 0) {
      return vals.map(() => 0);
    }
    return vals.map((v) => (Number.isFinite(v) ? (v / vmax) * scale : Number.NaN));
  }
  const pos = vals.filter((v) => Number.isFinite(v) && v > 0) as number[];
  if (pos.length === 0) return vals.map(() => Number.NaN);
  const vmin = Math.min(...pos);
  return vals.map((v) =>
    Number.isFinite(v) && v > 0 ? (vmin / v) * scale : Number.NaN,
  );
}

/** Jose's name for benefit ratio (directamente proporcional). */
export function normalizeDmp(
  series: readonly (number | null)[],
  scaleMax = 10,
): number[] {
  return normalizeRatioLegacy(series, "benefit", scaleMax);
}

/** Jose's name for cost ratio (inversamente proporcional). */
export function normalizeImp(
  series: readonly (number | null)[],
  scaleMax = 10,
): number[] {
  return normalizeRatioLegacy(series, "cost", scaleMax);
}

export function normalizeMinmax(
  series: readonly (number | null)[],
  direction: Direction,
): number[] {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  const finite = finiteValues(vals);
  if (finite.length === 0) return vals.map(() => Number.NaN);
  const vmin = Math.min(...finite);
  const vmax = Math.max(...finite);
  const span = vmax - vmin;
  if (span === 0) return vals.map(() => CONSTANT_MID_10);
  if (direction === "benefit") {
    return vals.map((v) =>
      Number.isFinite(v) ? ((v - vmin) / span) * 10 : Number.NaN,
    );
  }
  return vals.map((v) => (Number.isFinite(v) ? ((vmax - v) / span) * 10 : Number.NaN));
}

export function normalizeZscore(
  series: readonly (number | null)[],
  direction: Direction,
): number[] {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  const finite = finiteValues(vals);
  if (finite.length === 0) return vals.map(() => Number.NaN);
  const mu = mean(finite);
  const sigma = finite.length > 1 ? stdSample(finite) : 0;
  const z = vals.map((v) => {
    if (!Number.isFinite(v)) return Number.NaN;
    if (sigma === 0) return 0;
    return (v - mu) / sigma;
  });
  return direction === "benefit" ? z : z.map((v) => (Number.isFinite(v) ? -v : v));
}

/** Robust z-score: (x − median) / (1.4826 · MAD); cost flips sign after. */
export function normalizeRobustZ(
  series: readonly (number | null)[],
  direction: Direction,
): number[] {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  const finite = finiteValues(vals);
  if (finite.length === 0) return vals.map(() => Number.NaN);
  const med = median(finite);
  const mad = median(finite.map((v) => Math.abs(v - med)));
  const denom = mad === 0 ? 0 : mad * MAD_SCALE;
  const z = vals.map((v) => {
    if (!Number.isFinite(v)) return Number.NaN;
    if (denom === 0) return 0;
    return (v - med) / denom;
  });
  return direction === "benefit" ? z : z.map((v) => (Number.isFinite(v) ? -v : v));
}

export function normalizeRank(
  series: readonly (number | null)[],
  direction: Direction,
): number[] {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  const mask = vals.map((v) => Number.isFinite(v));
  const finite = vals.filter((_, i) => mask[i]) as number[];
  const n = finite.length;
  if (n === 0) return vals.map(() => Number.NaN);
  const forRank = direction === "benefit" ? finite : finite.map((v) => -v);
  const ranks = rankAverage(forRank);
  const out = vals.map(() => Number.NaN);
  let k = 0;
  for (let i = 0; i < vals.length; i++) {
    if (mask[i]) {
      out[i] = (ranks[k]! / n) * 10;
      k++;
    }
  }
  return out;
}

export function normalizeLogMinmax(
  series: readonly (number | null)[],
  direction: Direction,
): number[] {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  const finite = finiteValues(vals);
  if (finite.length === 0) return vals.map(() => Number.NaN);
  const vmin = Math.min(...finite);
  const logged = vals.map((v) =>
    Number.isFinite(v) ? Math.log(v - vmin + 1e-12) : Number.NaN,
  );
  return normalizeMinmax(logged, direction);
}

const DISPATCH: Record<
  NormalizationId,
  (s: readonly (number | null)[], d: Direction) => number[]
> = {
  ratio_legacy: normalizeRatioLegacy,
  minmax: normalizeMinmax,
  zscore: normalizeZscore,
  robust_z: normalizeRobustZ,
  rank: normalizeRank,
  log_minmax: normalizeLogMinmax,
};

export function normalizeColumn(
  series: readonly (number | null)[],
  direction: Direction,
  method: NormalizationId,
): number[] {
  const fn = DISPATCH[method];
  if (!fn) throw new Error(`Unknown normalisation method: ${method}`);
  return fn(series, direction);
}

export function normalizeMatrix(
  matrix: readonly (readonly (number | null)[])[],
  columns: readonly string[],
  directions: Readonly<Record<string, Direction>>,
  method: NormalizationId,
): number[][] {
  if (matrix.length === 0) return [];
  const nCols = columns.length;
  const seriesByCol: (number | null)[][] = Array.from({ length: nCols }, () => []);
  for (const row of matrix) {
    for (let j = 0; j < nCols; j++) seriesByCol[j]!.push(row[j] ?? null);
  }
  const normCols = columns.map((col, j) => {
    const dir = directions[col];
    if (dir === undefined) throw new Error(`Missing direction for column ${col}`);
    return normalizeColumn(seriesByCol[j]!, dir, method);
  });
  return matrix.map((_, i) => normCols.map((col) => col[i]!));
}
