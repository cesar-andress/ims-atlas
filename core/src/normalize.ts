/**
 * Cross-section normalisation (ports ``imsfe.normalize``, SPEC §5).
 * Scale targets match ims-backtest: [0, 10] for minmax/ratio/rank; z-score unbounded.
 */

import { finiteValues, isFiniteNumber, mean, rankAverage, stdSample } from "./math.js";
import type { Direction, NormalizationId } from "./types.js";

const CONSTANT_MID_10 = 5.0;

export function normalizeRatioLegacy(
  series: readonly (number | null)[],
  direction: Direction,
): number[] {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  if (direction === "benefit") {
    const finite = finiteValues(vals);
    const vmax = finite.length ? Math.max(...finite) : Number.NaN;
    if (!Number.isFinite(vmax) || vmax === 0) {
      return vals.map(() => 0);
    }
    return vals.map((v) => (Number.isFinite(v) ? (v / vmax) * 10 : Number.NaN));
  }
  const pos = vals.filter((v) => Number.isFinite(v) && v > 0) as number[];
  if (pos.length === 0) return vals.map(() => Number.NaN);
  const vmin = Math.min(...pos);
  return vals.map((v) => (Number.isFinite(v) && v > 0 ? (vmin / v) * 10 : Number.NaN));
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
