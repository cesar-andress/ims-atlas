/** Numeric helpers matching NumPy / pymcdm conventions used by ims-backtest. */

export function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function finiteValues(xs: readonly (number | null | undefined)[]): number[] {
  const out: number[] = [];
  for (const x of xs) {
    if (isFiniteNumber(x)) out.push(x);
  }
  return out;
}

/** Population std (ddof=0), matching ``numpy.std`` default / pymcdm pearson. */
export function stdPop(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const mu = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - mu) ** 2;
  return Math.sqrt(acc / xs.length);
}

/** Sample std (ddof=1), matching ``pandas.Series.std(ddof=1)`` / CRITIC. */
export function stdSample(xs: readonly number[]): number {
  if (xs.length <= 1) return 0;
  const mu = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - mu) ** 2;
  return Math.sqrt(acc / (xs.length - 1));
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Population covariance (bias=True), matching pymcdm ``_cov``. */
export function covPop(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length || x.length === 0) return Number.NaN;
  const mx = mean(x);
  const my = mean(y);
  let acc = 0;
  for (let i = 0; i < x.length; i++) acc += (x[i]! - mx) * (y[i]! - my);
  return acc / x.length;
}

/** Pearson with population std/cov (pymcdm.correlations.pearson). */
export function pearson(x: readonly number[], y: readonly number[]): number {
  const sx = stdPop(x);
  const sy = stdPop(y);
  if (sx === 0 || sy === 0) return Number.NaN;
  return covPop(x, y) / (sx * sy);
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Average ranks starting at 1 (scipy.stats.rankdata method="average").
 * Ties share the mean of the ranks they would occupy.
 */
export function rankAverage(values: readonly number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1]!.v === indexed[i]!.v) j++;
    const rank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) ranks[indexed[k]!.i] = rank;
    i = j + 1;
  }
  return ranks;
}

/**
 * Descending score order for rankings. Non-finite scores (NaN / ±Infinity)
 * sort after every finite score. When both sides are non-finite or tied,
 * callers pass a tie-break (e.g. ISO3 localeCompare).
 *
 * Important: do not use `b - a || tieBreak` alone — `NaN` is falsy, so that
 * pattern falls through to the tie-break and can rank missing scores as if
 * they were competitive (e.g. alphabetical ISO order as "top markets").
 */
export function compareScoreDescending(
  scoreA: number,
  scoreB: number,
  tieBreak = 0,
): number {
  const aOk = Number.isFinite(scoreA);
  const bOk = Number.isFinite(scoreB);
  if (aOk && !bOk) return -1;
  if (!aOk && bOk) return 1;
  if (aOk && bOk) {
    const d = scoreB - scoreA;
    if (d !== 0) return d;
  }
  return tieBreak;
}

export function column(matrix: readonly (readonly number[])[], j: number): number[] {
  return matrix.map((row) => row[j]!);
}

export function transpose(matrix: readonly (readonly number[])[]): number[][] {
  if (matrix.length === 0) return [];
  const cols = matrix[0]!.length;
  const out: number[][] = Array.from({ length: cols }, () => []);
  for (const row of matrix) {
    for (let j = 0; j < cols; j++) out[j]!.push(row[j]!);
  }
  return out;
}
