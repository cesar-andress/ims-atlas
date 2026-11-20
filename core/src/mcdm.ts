/**
 * MCDM aggregation (ports ``imsfe.mcdm`` / pymcdm TOPSIS, VIKOR, PROMETHEE II).
 */

import { column } from "./math.js";
import type { Direction, HierarchicalWeights, McdmId } from "./types.js";
import { flatWeights, restrictWeights } from "./weights.js";

function typesVector(
  columns: readonly string[],
  directions: Readonly<Record<string, Direction>>,
): number[] {
  return columns.map((c) => {
    const d = directions[c];
    if (d === undefined) throw new Error(`Missing direction for ${c}`);
    return d === "benefit" ? 1 : -1;
  });
}

function flatWeightsArray(
  weights: HierarchicalWeights,
  columns: readonly string[],
): number[] {
  const flat = flatWeights(weights, columns);
  const arr = columns.map((c) => flat[c] ?? 0);
  const total = arr.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("flat weights sum to zero");
  return arr.map((w) => w / total);
}

type FactorColMeta = { idxs: number[]; w: number[] };

function buildFactorCols(
  columns: readonly string[],
  weights: HierarchicalWeights,
): { factorNames: string[]; factorCols: Map<string, FactorColMeta>; fw: number[] } {
  const factorCols = new Map<string, FactorColMeta>();

  for (const [factor, vw] of Object.entries(weights.variablesWithin)) {
    const idxs: number[] = [];
    const w: number[] = [];
    for (const [vid, weight] of Object.entries(vw)) {
      const j = columns.indexOf(vid);
      if (j >= 0) {
        idxs.push(j);
        w.push(weight);
      }
    }
    if (idxs.length === 0) continue;
    const wSum = w.reduce((a, b) => a + b, 0);
    factorCols.set(factor, {
      idxs,
      w: w.map((x) => x / wSum),
    });
  }

  const factorNames = [...factorCols.keys()];
  if (factorNames.length === 0) {
    throw new Error("No overlapping factors between weights and matrix");
  }
  let fw = factorNames.map((f) => weights.factors[f] ?? 0);
  const fwSum = fw.reduce((a, b) => a + b, 0);
  // Misaligned manual weights (e.g. openness_legacy vs panel "openness") used to
  // yield fwSum=0 and crash the UI. Fall back to equal factor weights.
  if (fwSum <= 0) {
    fw = factorNames.map(() => 1 / factorNames.length);
  } else {
    fw = fw.map((x) => x / fwSum);
  }
  return { factorNames, factorCols, fw };
}

/** Per-candidate within-factor scores (before factor weight), then overall WSM. */
export function factorContributions(
  normalized: readonly (readonly number[])[],
  columns: readonly string[],
  weights: HierarchicalWeights,
): { factors: string[]; perCandidate: Record<string, number>[]; scores: number[] } {
  const n = normalized.length;
  const { factorNames, factorCols, fw } = buildFactorCols(columns, weights);
  const perCandidate: Record<string, number>[] = [];
  const scores = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const row: Record<string, number> = {};
    let score = 0;
    for (let fi = 0; fi < factorNames.length; fi++) {
      const name = factorNames[fi]!;
      const meta = factorCols.get(name)!;
      let fs = 0;
      for (let k = 0; k < meta.idxs.length; k++) {
        fs += normalized[i]![meta.idxs[k]!]! * meta.w[k]!;
      }
      row[name] = fs;
      score += fs * fw[fi]!;
    }
    perCandidate.push(row);
    scores[i] = score;
  }
  return { factors: factorNames, perCandidate, scores };
}

/** Hierarchical WSM on a direction-aware normalised matrix (higher = better). */
export function hierarchicalWsm(
  normalized: readonly (readonly number[])[],
  columns: readonly string[],
  weights: HierarchicalWeights,
): number[] {
  return factorContributions(normalized, columns, weights).scores;
}

/** pymcdm minmax_normalization used by default TOPSIS. */
function pymcdmMinmax(col: readonly number[], cost: boolean): number[] {
  const vmin = Math.min(...col);
  const vmax = Math.max(...col);
  if (vmin === vmax) return col.map(() => 1);
  if (cost) return col.map((x) => (vmax - x) / (vmax - vmin));
  return col.map((x) => (x - vmin) / (vmax - vmin));
}

function normalizeMatrixPymcdm(
  matrix: readonly (readonly number[])[],
  types: readonly number[],
  normFn: (col: readonly number[], cost: boolean) => number[],
): number[][] {
  const n = matrix.length;
  const m = types.length;
  const out: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let j = 0; j < m; j++) {
    const col = column(matrix, j);
    const cost = types[j] === -1;
    const ncol = normFn(col, cost);
    for (let i = 0; i < n; i++) out[i]![j] = ncol[i]!;
  }
  return out;
}

export function scoreTopsis(
  matrix: readonly (readonly number[])[],
  columns: readonly string[],
  weights: HierarchicalWeights,
  directions: Readonly<Record<string, Direction>>,
): number[] {
  const w = flatWeightsArray(weights, columns);
  const types = typesVector(columns, directions);
  const nmatrix = normalizeMatrixPymcdm(matrix, types, pymcdmMinmax);
  const n = nmatrix.length;
  const m = columns.length;
  const weighted = nmatrix.map((row) => row.map((v, j) => v * w[j]!));
  const pis = Array.from({ length: m }, (_, j) =>
    Math.max(...weighted.map((r) => r[j]!)),
  );
  const nis = Array.from({ length: m }, (_, j) =>
    Math.min(...weighted.map((r) => r[j]!)),
  );
  const scores = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let dp = 0;
    let dm = 0;
    for (let j = 0; j < m; j++) {
      dp += (weighted[i]![j]! - pis[j]!) ** 2;
      dm += (weighted[i]![j]! - nis[j]!) ** 2;
    }
    dp = Math.sqrt(dp);
    dm = Math.sqrt(dm);
    scores[i] = dm / (dm + dp);
  }
  return scores;
}

/** VIKOR fake normalisation (default in pymcdm): cost → max-x, benefit → x. */
function vikorFakeNorm(col: readonly number[], cost: boolean): number[] {
  if (cost) {
    const mx = Math.max(...col);
    return col.map((x) => mx - x);
  }
  return [...col];
}

export function scoreVikor(
  matrix: readonly (readonly number[])[],
  columns: readonly string[],
  weights: HierarchicalWeights,
  directions: Readonly<Record<string, Direction>>,
  v = 0.5,
): number[] {
  const varying: string[] = [];
  const varyingIdx: number[] = [];
  for (let j = 0; j < columns.length; j++) {
    const col = column(matrix, j);
    const uniq = new Set(col);
    if (uniq.size > 1) {
      varying.push(columns[j]!);
      varyingIdx.push(j);
    }
  }
  if (varying.length < 1) return matrix.map(() => 0);

  const sub = matrix.map((row) => varyingIdx.map((j) => row[j]!));
  const wObj = restrictWeights(weights, varying);
  const w = flatWeightsArray(wObj, varying);
  const types = typesVector(varying, directions);
  const nmatrix = normalizeMatrixPymcdm(sub, types, vikorFakeNorm);
  const n = nmatrix.length;
  const m = varying.length;

  const fstar = Array.from({ length: m }, (_, j) =>
    Math.max(...nmatrix.map((r) => r[j]!)),
  );
  const fminus = Array.from({ length: m }, (_, j) =>
    Math.min(...nmatrix.map((r) => r[j]!)),
  );
  for (let j = 0; j < m; j++) {
    if (fstar[j] === fminus[j]) {
      throw new Error(
        `VIKOR: criterion ${varying[j]} has equal values after normalisation`,
      );
    }
  }

  const S = new Array<number>(n).fill(0);
  const R = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let r = -Infinity;
    for (let j = 0; j < m; j++) {
      const val = (w[j]! * (fstar[j]! - nmatrix[i]![j]!)) / (fstar[j]! - fminus[j]!);
      s += val;
      if (val > r) r = val;
    }
    S[i] = s;
    R[i] = r;
  }
  const Sstar = Math.min(...S);
  const Sminus = Math.max(...S);
  const Rstar = Math.min(...R);
  const Rminus = Math.max(...R);
  const Q = S.map(
    (s, i) =>
      (v * (s - Sstar)) / (Sminus - Sstar) +
      ((1 - v) * (R[i]! - Rstar)) / (Rminus - Rstar),
  );
  // imsfe returns -Q so higher is better
  return Q.map((q) => -q);
}

/** PROMETHEE II with usual preference function (pymcdm). */
export function scorePrometheeIi(
  matrix: readonly (readonly number[])[],
  columns: readonly string[],
  weights: HierarchicalWeights,
  directions: Readonly<Record<string, Direction>>,
): number[] {
  const w = flatWeightsArray(weights, columns);
  const types = typesVector(columns, directions);
  const n = matrix.length;
  const m = columns.length;

  // pi[i][k] = sum_j w_j * P_j(a_i, a_k)
  const pi: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let j = 0; j < m; j++) {
    const col = column(matrix, j);
    const t = types[j]!;
    const wj = w[j]!;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        const d = t === 1 ? col[i]! - col[k]! : col[k]! - col[i]!;
        const pref = d > 0 ? 1 : 0;
        pi[i]![k]! += wj * pref;
      }
    }
  }

  const denom = n - 1;
  const scores = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let fPlus = 0;
    let fMinus = 0;
    for (let k = 0; k < n; k++) {
      fPlus += pi[i]![k]!;
      fMinus += pi[k]![i]!;
    }
    scores[i] = fPlus / denom - fMinus / denom;
  }
  return scores;
}

export function score(
  matrix: readonly (readonly number[])[],
  columns: readonly string[],
  weights: HierarchicalWeights,
  directions: Readonly<Record<string, Direction>>,
  method: McdmId,
  opts?: { normalized?: readonly (readonly number[])[] },
): number[] {
  if (method === "wsm") {
    if (!opts?.normalized) throw new Error("WSM requires a pre-normalised matrix");
    return hierarchicalWsm(opts.normalized, columns, weights);
  }
  if (method === "topsis") return scoreTopsis(matrix, columns, weights, directions);
  if (method === "vikor") return scoreVikor(matrix, columns, weights, directions);
  if (method === "promethee_ii") {
    return scorePrometheeIi(matrix, columns, weights, directions);
  }
  throw new Error(`Unknown MCDM method: ${method}`);
}
