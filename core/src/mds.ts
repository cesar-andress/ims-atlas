/**
 * Classical MDS init + SMACOF (2D) for market-map layouts (SPEC §5 / §6.6).
 * Deterministic for a fixed distance matrix (no RNG in the SMACOF loop).
 */

export type Point2 = { x: number; y: number };

export type SmacofResult = {
  points: Point2[];
  /** Kruskal stress-1 at each accepted iterate (index 0 = init). */
  stressHistory: number[];
  iterations: number;
};

function euclidean(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Pairwise Euclidean distances for row vectors. */
export function pairwiseDistances(matrix: readonly (readonly number[])[]): number[][] {
  const n = matrix.length;
  const d: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = euclidean(matrix[i]!, matrix[j]!);
      d[i]![j] = dist;
      d[j]![i] = dist;
    }
  }
  return d;
}

/** Kruskal stress-1: sqrt(sum (d_ij - δ_ij)^2 / sum d_ij^2). */
export function kruskalStress(
  points: readonly Point2[],
  distances: readonly (readonly number[])[],
): number {
  const n = points.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = points[i]!.x - points[j]!.x;
      const dy = points[i]!.y - points[j]!.y;
      const delta = Math.sqrt(dx * dx + dy * dy);
      const d = distances[i]![j]!;
      const e = d - delta;
      num += e * e;
      den += d * d;
    }
  }
  if (den <= 0) return 0;
  return Math.sqrt(num / den);
}

type EigenPair = { value: number; vector: number[] };

function matVec(A: readonly (readonly number[])[], v: readonly number[]): number[] {
  const n = A.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += A[i]![j]! * v[j]!;
    out[i] = s;
  }
  return out;
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function normalizeInPlace(v: number[]): void {
  const n = Math.hypot(...v);
  if (n < 1e-15) return;
  for (let i = 0; i < v.length; i++) v[i]! /= n;
}

/** Power iteration + deflation for the top-k symmetric eigenpairs. */
function topEigenpairs(A: readonly (readonly number[])[], k: number): EigenPair[] {
  const n = A.length;
  const out: EigenPair[] = [];
  const M: number[][] = A.map((row) => [...row]);

  for (let comp = 0; comp < k; comp++) {
    const v = new Array<number>(n).fill(0);
    if (comp < n) v[comp] = 1;
    else v.fill(1 / Math.sqrt(n));
    normalizeInPlace(v);

    let value = 0;
    for (let iter = 0; iter < 200; iter++) {
      const Mv = matVec(M, v);
      const norm = Math.hypot(...Mv);
      if (norm < 1e-15) break;
      for (let i = 0; i < n; i++) v[i] = Mv[i]! / norm;
      value = dot(v, matVec(M, v));
    }
    value = dot(v, matVec(M, v));
    if (value <= 1e-12) break;
    let sign = 1;
    for (let i = 0; i < n; i++) {
      if (Math.abs(v[i]!) > 1e-12) {
        sign = v[i]! < 0 ? -1 : 1;
        break;
      }
    }
    if (sign < 0) for (let i = 0; i < n; i++) v[i]! *= -1;
    out.push({ value, vector: [...v] });
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        M[i]![j]! -= value * v[i]! * v[j]!;
      }
    }
  }
  return out;
}

/** Centre at origin; flip so max-|x| point has x≥0, then max-|y| has y≥0. */
export function centerAndOrient(points: Point2[]): Point2[] {
  if (points.length === 0) return [];
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  const out = points.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  let maxAbsX = -1;
  let ix = 0;
  for (let i = 0; i < out.length; i++) {
    if (Math.abs(out[i]!.x) > maxAbsX) {
      maxAbsX = Math.abs(out[i]!.x);
      ix = i;
    }
  }
  if (out[ix]!.x < 0) for (const p of out) p.x *= -1;
  let maxAbsY = -1;
  let iy = 0;
  for (let i = 0; i < out.length; i++) {
    if (Math.abs(out[i]!.y) > maxAbsY) {
      maxAbsY = Math.abs(out[i]!.y);
      iy = i;
    }
  }
  if (out[iy]!.y < 0) for (const p of out) p.y *= -1;
  return out;
}

/**
 * Classical MDS (Torgerson) in 2D via double-centring + power iteration for
 * the two leading eigenvectors (deterministic, no library eigendecomp).
 */
export function classicalMds2d(distances: readonly (readonly number[])[]): Point2[] {
  const n = distances.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];

  const d2: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = distances[i]![j]!;
      d2[i]![j] = d * d;
    }
  }
  const rowMean = new Array<number>(n).fill(0);
  const colMean = new Array<number>(n).fill(0);
  let grand = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      rowMean[i]! += d2[i]![j]!;
      colMean[j]! += d2[i]![j]!;
      grand += d2[i]![j]!;
    }
  }
  for (let i = 0; i < n; i++) rowMean[i]! /= n;
  for (let j = 0; j < n; j++) colMean[j]! /= n;
  grand /= n * n;

  const B: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      B[i]![j] = -0.5 * (d2[i]![j]! - rowMean[i]! - colMean[j]! + grand);
    }
  }

  const evecs = topEigenpairs(B, 2);
  const points: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const x = evecs[0]
      ? Math.sqrt(Math.max(evecs[0].value, 0)) * evecs[0].vector[i]!
      : 0;
    const y = evecs[1]
      ? Math.sqrt(Math.max(evecs[1].value, 0)) * evecs[1].vector[i]!
      : 0;
    points.push({ x, y });
  }
  return centerAndOrient(points);
}

/** Guttman transform: X ← (1/n) B⁺(Z) Z. */
function guttmanUpdate(
  points: readonly Point2[],
  distances: readonly (readonly number[])[],
): Point2[] {
  const n = points.length;
  const next: Point2[] = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = points[i]!.x - points[j]!.x;
      const dy = points[i]!.y - points[j]!.y;
      const delta = Math.sqrt(dx * dx + dy * dy);
      const d = distances[i]![j]!;
      let bij = 0;
      if (delta > 1e-15) bij = -d / delta;
      // Contribution of off-diagonal B_ij * z_j and diagonal part via identity trick:
      // row i of B⁺Z = sum_{j≠i} (d_ij/δ_ij)(z_i - z_j)
      void bij;
      if (delta > 1e-15) {
        const coef = d / delta;
        sx += coef * (points[i]!.x - points[j]!.x);
        sy += coef * (points[i]!.y - points[j]!.y);
      }
    }
    next[i] = { x: sx / n, y: sy / n };
  }
  return next;
}

export type SmacofOptions = {
  maxIterations?: number;
  /** Absolute stress improvement stop. */
  epsilon?: number;
  /** Optional initial configuration; defaults to classical MDS. */
  init?: Point2[];
};

/**
 * SMACOF metric MDS in 2D. Stress history is non-increasing (to numerical tolerance).
 */
export function smacof2d(
  distances: readonly (readonly number[])[],
  opts: SmacofOptions = {},
): SmacofResult {
  const n = distances.length;
  const maxIterations = opts.maxIterations ?? 80;
  const epsilon = opts.epsilon ?? 1e-9;
  let points = opts.init ? opts.init.map((p) => ({ ...p })) : classicalMds2d(distances);
  if (n === 0) return { points: [], stressHistory: [], iterations: 0 };

  const stressHistory: number[] = [kruskalStress(points, distances)];

  for (let iter = 0; iter < maxIterations; iter++) {
    const updated = centerAndOrient(guttmanUpdate(points, distances));
    const stress = kruskalStress(updated, distances);
    const prev = stressHistory[stressHistory.length - 1]!;
    if (stress > prev + 1e-10) break;
    points = updated;
    stressHistory.push(stress);
    if (prev - stress < epsilon) break;
  }

  return {
    points,
    stressHistory,
    iterations: stressHistory.length - 1,
  };
}

/** Convenience: Euclidean distances from a criteria matrix → SMACOF 2D. */
export function layoutFromProfiles(
  matrix: readonly (readonly number[])[],
  opts?: SmacofOptions,
): SmacofResult {
  return smacof2d(pairwiseDistances(matrix), opts);
}
