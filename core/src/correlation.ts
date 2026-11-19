/**
 * Correlation diagnostics and optional whitening (Phase Z).
 * Decorrelate is off by default — it changes the meaning of weights.
 */

import { covPop, finiteValues, isFiniteNumber, mean, pearson } from "./math.js";

export type CorrelationWarning = {
  a: string;
  b: string;
  rho: number;
  messageEn: string;
  messageEs: string;
};

const DEFAULT_THRESHOLD = 0.8;

export function correlationMatrix(
  columns: readonly string[],
  seriesByCol: readonly (readonly (number | null)[])[],
): number[][] {
  const n = columns.length;
  const mat: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => Number.NaN),
  );
  for (let i = 0; i < n; i++) {
    mat[i]![i] = 1;
    for (let j = i + 1; j < n; j++) {
      const xi = seriesByCol[i]!;
      const yj = seriesByCol[j]!;
      const pairedX: number[] = [];
      const pairedY: number[] = [];
      const m = Math.min(xi.length, yj.length);
      for (let k = 0; k < m; k++) {
        const a = xi[k];
        const b = yj[k];
        if (isFiniteNumber(a) && isFiniteNumber(b)) {
          pairedX.push(a);
          pairedY.push(b);
        }
      }
      const rho = pairedX.length >= 3 ? pearson(pairedX, pairedY) : Number.NaN;
      mat[i]![j] = rho;
      mat[j]![i] = rho;
    }
  }
  return mat;
}

export function highCorrelationWarnings(
  columns: readonly string[],
  matrix: readonly (readonly number[])[],
  threshold = DEFAULT_THRESHOLD,
): CorrelationWarning[] {
  const out: CorrelationWarning[] = [];
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const rho = matrix[i]?.[j];
      if (typeof rho !== "number" || !Number.isFinite(rho)) continue;
      if (Math.abs(rho) >= threshold) {
        const a = columns[i]!;
        const b = columns[j]!;
        out.push({
          a,
          b,
          rho,
          messageEn: `${a} and ${b} measure almost the same thing (|ρ|=${Math.abs(rho).toFixed(2)}): you may be double-counting.`,
          messageEs: `${a} y ${b} miden casi lo mismo (|ρ|=${Math.abs(rho).toFixed(2)}): estás contando dos veces.`,
        });
      }
    }
  }
  return out;
}

/**
 * Column-whiten a candidate×variable matrix (Mahalanobis / ZCA-style).
 * Centers columns, then multiplies by Cov^{-1/2}. Constant columns stay 0.
 */
export function whitenMatrix(matrix: readonly (readonly number[])[]): number[][] {
  const n = matrix.length;
  if (n === 0) return [];
  const p = matrix[0]?.length ?? 0;
  if (p === 0) return matrix.map(() => []);

  // Center
  const means: number[] = [];
  for (let j = 0; j < p; j++) {
    const col = finiteValues(matrix.map((row) => row[j] ?? Number.NaN));
    means.push(col.length ? mean(col) : 0);
  }
  const centered = matrix.map((row) =>
    row.map((v, j) => (Number.isFinite(v) ? v - means[j]! : 0)),
  );

  // Covariance p×p (population)
  const cov: number[][] = Array.from({ length: p }, () =>
    Array.from({ length: p }, () => 0),
  );
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      const xi = centered.map((r) => r[i]!);
      const yj = centered.map((r) => r[j]!);
      const c = covPop(xi, yj);
      cov[i]![j] = Number.isFinite(c) ? c : 0;
      cov[j]![i] = cov[i]![j]!;
    }
  }

  const { values: eigVals, vectors: eigVecs } = eigenSym(cov);
  // Cov^{-1/2} = V * diag(1/sqrt(λ)) * V^T
  const invSqrt: number[][] = Array.from({ length: p }, () =>
    Array.from({ length: p }, () => 0),
  );
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      let s = 0;
      for (let k = 0; k < p; k++) {
        const lam = eigVals[k]!;
        const scale = lam > 1e-12 ? 1 / Math.sqrt(lam) : 0;
        s += eigVecs[a]![k]! * scale * eigVecs[b]![k]!;
      }
      invSqrt[a]![b] = s;
    }
  }

  return centered.map((row) => {
    const out = new Array<number>(p).fill(0);
    for (let j = 0; j < p; j++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += row[k]! * invSqrt[k]![j]!;
      out[j] = s;
    }
    return out;
  });
}

/** Jacobi eigen-decomposition for small symmetric matrices. */
function eigenSym(aIn: number[][]): { values: number[]; vectors: number[][] } {
  const n = aIn.length;
  const a = aIn.map((row) => [...row]);
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );

  for (let iter = 0; iter < 64; iter++) {
    let max = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const abs = Math.abs(a[i]![j]!);
        if (abs > max) {
          max = abs;
          p = i;
          q = j;
        }
      }
    }
    if (max < 1e-12) break;
    const app = a[p]![p]!;
    const aqq = a[q]![q]!;
    const apq = a[p]![q]!;
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    for (let i = 0; i < n; i++) {
      const aip = a[i]![p]!;
      const aiq = a[i]![q]!;
      a[i]![p] = c * aip - s * aiq;
      a[i]![q] = s * aip + c * aiq;
    }
    for (let i = 0; i < n; i++) {
      const api = a[p]![i]!;
      const aqi = a[q]![i]!;
      a[p]![i] = c * api - s * aqi;
      a[q]![i] = s * api + c * aqi;
    }
    for (let i = 0; i < n; i++) {
      const vip = v[i]![p]!;
      const viq = v[i]![q]!;
      v[i]![p] = c * vip - s * viq;
      v[i]![q] = s * vip + c * viq;
    }
  }

  return {
    values: a.map((row, i) => row[i]!),
    vectors: v,
  };
}
