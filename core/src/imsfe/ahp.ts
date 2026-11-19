/**
 * Saaty AHP (1–9 pairwise): eigenvector weights, λ_max, CI, RI, CR.
 * Several experts → geometric mean of pairwise matrices.
 */

const RI_BY_N: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

export type AhpResult = {
  weights: number[];
  lambdaMax: number;
  ci: number;
  ri: number;
  cr: number;
  /** Pair (i,j) with largest |a_ij − w_i/w_j|. */
  mostInconsistent?: { i: number; j: number } | undefined;
};

function matMul(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((s, x, j) => s + x * (v[j] ?? 0), 0));
}

function normalize(v: number[]): number[] {
  const s = v.reduce((a, b) => a + b, 0);
  if (s === 0) return v.map(() => 0);
  return v.map((x) => x / s);
}

/** Power iteration for principal eigenvector of a positive pairwise matrix. */
export function ahpFromPairwise(matrix: number[][]): AhpResult {
  const n = matrix.length;
  if (n === 0) {
    return { weights: [], lambdaMax: 0, ci: 0, ri: 0, cr: 0 };
  }
  for (const row of matrix) {
    if (row.length !== n) throw new Error("AHP matrix must be square");
  }
  let v = Array.from({ length: n }, () => 1 / n);
  for (let iter = 0; iter < 40; iter++) {
    v = normalize(matMul(matrix, v));
  }
  const Av = matMul(matrix, v);
  const lambdaMax =
    n === 0 ? 0 : Av.reduce((s, x, i) => s + (v[i]! > 0 ? x / v[i]! : 0), 0) / n;
  const ci = n > 2 ? (lambdaMax - n) / (n - 1) : 0;
  const ri = RI_BY_N[n] ?? 1.49;
  const cr = ri > 0 ? ci / ri : 0;

  // Largest |a_ij − w_i/w_j| (Saaty reciprocal matrices already have a_ij*a_ji=1).
  let mostInconsistent: { i: number; j: number } | undefined;
  let worst = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const wi = v[i]!;
      const wj = v[j]!;
      if (wj === 0) continue;
      const err = Math.abs(matrix[i]![j]! - wi / wj);
      if (err > worst) {
        worst = err;
        mostInconsistent = { i, j };
      }
    }
  }

  const result: AhpResult = { weights: v, lambdaMax, ci, ri, cr };
  if (mostInconsistent) result.mostInconsistent = mostInconsistent;
  return result;
}

/** Geometric-mean aggregation of several pairwise matrices (same order). */
export function aggregatePairwiseGeometric(matrices: number[][][]): number[][] {
  if (matrices.length === 0) return [];
  const n = matrices[0]!.length;
  const out = Array.from({ length: n }, () => Array.from({ length: n }, () => 1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let prod = 1;
      for (const m of matrices) {
        prod *= m[i]![j]!;
      }
      out[i]![j] = Math.pow(prod, 1 / matrices.length);
    }
  }
  return out;
}

export function globalAhPWeights(
  factorWeights: number[],
  localWithin: number[][],
): number[] {
  const out: number[] = [];
  for (let f = 0; f < factorWeights.length; f++) {
    const locals = localWithin[f] ?? [];
    for (const w of locals) {
      out.push(factorWeights[f]! * w);
    }
  }
  return out;
}
