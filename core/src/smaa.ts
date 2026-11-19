/**
 * Stochastic multicriteria acceptability analysis (ports ``imsfe.smaa``).
 */

import { hierarchicalWsm } from "./mcdm.js";
import { createRng, randomDirichlet, type Rng } from "./rng.js";
import type { HierarchicalWeights } from "./types.js";

export type SamplingMode = "dirichlet" | "box";

export type WeightStats = {
  factorNames: string[];
  factorMu: number[];
  factorSigma: number[];
  factorMin: number[];
  factorMax: number[];
  /** Per factor: variable names + mu/sigma/min/max aligned. */
  within: Record<
    string,
    {
      names: string[];
      mu: number[];
      sigma: number[];
      min: number[];
      max: number[];
    }
  >;
};

export type SmaaResult = {
  alternatives: string[];
  criteria: string[];
  /** ranks[alt][sample], 1 = best */
  ranks: number[][];
  /** scores[alt][sample] */
  scores: number[][];
  /** acceptability[alt][rank-1] = P(alt has that rank) */
  acceptability: number[][];
  weightSamples: number[][];
  centralWeights: Record<string, number>;
  mode: SamplingMode;
  nSamples: number;
  seed: number;
  dispersionScale: number;
};

export function dirichletConcentration(
  mu: readonly number[],
  sigma: readonly number[],
  opts?: { dispersionScale?: number; minKappa?: number; maxKappa?: number },
): number {
  const dispersionScale = opts?.dispersionScale ?? 1;
  const minKappa = opts?.minKappa ?? 1;
  const maxKappa = opts?.maxKappa ?? 1e8;
  const scaled = sigma.map((s) => s * dispersionScale);
  if (
    dispersionScale <= 0 ||
    !scaled.some((s) => Number.isFinite(s)) ||
    Math.max(...scaled.filter(Number.isFinite)) <= 0
  ) {
    return maxKappa;
  }
  const kappas: number[] = [];
  for (let i = 0; i < mu.length; i++) {
    const m = mu[i]!;
    const s = scaled[i]!;
    if (!Number.isFinite(s) || s <= 0 || m <= 0 || m >= 1) continue;
    const k = (m * (1 - m)) / s ** 2 - 1;
    if (Number.isFinite(k) && k > 0) kappas.push(k);
  }
  if (kappas.length === 0) return maxKappa;
  kappas.sort((a, b) => a - b);
  const mid = Math.floor(kappas.length / 2);
  const kappa =
    kappas.length % 2 === 1 ? kappas[mid]! : (kappas[mid - 1]! + kappas[mid]!) / 2;
  return Math.min(maxKappa, Math.max(minKappa, kappa));
}

export function sampleDirichlet(
  mu: readonly number[],
  sigma: readonly number[],
  n: number,
  rng: Rng,
  dispersionScale = 1,
): number[][] {
  const sum = mu.reduce((a, b) => a + b, 0);
  const muN = mu.map((m) => m / sum);
  const kappa = dirichletConcentration(muN, sigma, { dispersionScale });
  if (kappa >= 1e7 || dispersionScale <= 0) {
    return Array.from({ length: n }, () => [...muN]);
  }
  const alpha = muN.map((m) => Math.max(1e-12, kappa * m));
  return Array.from({ length: n }, () => randomDirichlet(rng, alpha));
}

export function sampleBox(
  lows: readonly number[],
  highs: readonly number[],
  n: number,
  rng: Rng,
): number[][] {
  const out: number[][] = [];
  for (let s = 0; s < n; s++) {
    const row = lows.map((lo, j) => Math.max(1e-12, rng.uniform(lo, highs[j]!)));
    const tot = row.reduce((a, b) => a + b, 0);
    out.push(row.map((x) => x / tot));
  }
  return out;
}

export function sampleHierarchicalWeights(
  stats: WeightStats,
  nSamples: number,
  rng: Rng,
  opts?: {
    mode?: SamplingMode;
    dispersionScale?: number;
    columns?: readonly string[];
  },
): { weights: number[][]; names: string[] } {
  const mode = opts?.mode ?? "dirichlet";
  const dispersionScale = opts?.dispersionScale ?? 1;
  const fW =
    mode === "dirichlet"
      ? sampleDirichlet(
          stats.factorMu,
          stats.factorSigma,
          nSamples,
          rng,
          dispersionScale,
        )
      : sampleBox(stats.factorMin, stats.factorMax, nSamples, rng);

  const pieces: number[][][] = [];
  const names: string[] = [];
  for (let i = 0; i < stats.factorNames.length; i++) {
    const factor = stats.factorNames[i]!;
    const block = stats.within[factor]!;
    const vnames = block.names;
    const vW =
      mode === "dirichlet"
        ? sampleDirichlet(block.mu, block.sigma, nSamples, rng, dispersionScale)
        : sampleBox(block.min, block.max, nSamples, rng);
    const contrib = vW.map((row, s) => row.map((w) => fW[s]![i]! * w));
    pieces.push(contrib);
    names.push(...vnames);
  }

  let flat = Array.from({ length: nSamples }, (_, s) => {
    const row: number[] = [];
    for (const piece of pieces) row.push(...piece[s]!);
    return row;
  });

  if (opts?.columns) {
    const idx = new Map(names.map((n, j) => [n, j]));
    const keep = opts.columns.filter((c) => idx.has(c));
    flat = flat.map((row) => keep.map((c) => row[idx.get(c)!]!));
    const renorm = flat.map((row) => {
      const tot = row.reduce((a, b) => a + b, 0);
      const d = tot > 1e-15 ? tot : 1e-15;
      return row.map((x) => x / d);
    });
    return { weights: renorm, names: keep };
  }

  flat = flat.map((row) => {
    const tot = row.reduce((a, b) => a + b, 0);
    const d = tot > 1e-15 ? tot : 1e-15;
    return row.map((x) => x / d);
  });
  return { weights: flat, names };
}

/** Ranks (1=best) for score matrix scores[alt][sample]. Mergesort-stable like numpy. */
export function ranksFromScores(scores: readonly (readonly number[])[]): number[][] {
  const nAlt = scores.length;
  const nSamples = scores[0]?.length ?? 0;
  const ranks: number[][] = Array.from({ length: nAlt }, () => Array(nSamples).fill(0));
  for (let s = 0; s < nSamples; s++) {
    const order = Array.from({ length: nAlt }, (_, i) => i);
    // stable sort by -score
    order.sort((a, b) => {
      const d = scores[b]![s]! - scores[a]![s]!;
      if (d !== 0) return d > 0 ? 1 : -1;
      return a - b;
    });
    for (let r = 0; r < nAlt; r++) ranks[order[r]!]![s] = r + 1;
  }
  return ranks;
}

export function rankAcceptability(ranks: readonly (readonly number[])[]): number[][] {
  const nAlt = ranks.length;
  const nSamples = ranks[0]?.length ?? 0;
  const b: number[][] = Array.from({ length: nAlt }, () => Array(nAlt).fill(0));
  for (let r = 1; r <= nAlt; r++) {
    for (let j = 0; j < nAlt; j++) {
      let c = 0;
      for (let s = 0; s < nSamples; s++) if (ranks[j]![s] === r) c++;
      b[j]![r - 1] = c / nSamples;
    }
  }
  return b;
}

export function pTopK(ranks: readonly (readonly number[])[], k: number): number[] {
  const nAlt = ranks.length;
  const nSamples = ranks[0]?.length ?? 0;
  return Array.from({ length: nAlt }, (_, j) => {
    let c = 0;
    for (let s = 0; s < nSamples; s++) if (ranks[j]![s]! <= k) c++;
    return c / nSamples;
  });
}

/**
 * Vectorised SMAA for hierarchical WSM on a pre-normalised matrix
 * (columns already higher=better). Flat weight samples applied as N @ W.T.
 */
export function runSmaaWsm(
  normalized: readonly (readonly number[])[],
  alternatives: readonly string[],
  columns: readonly string[],
  stats: WeightStats,
  opts?: {
    nSamples?: number;
    seed?: number;
    mode?: SamplingMode;
    dispersionScale?: number;
    /** Inject precomputed weight samples (for exact golden tests). */
    weightSamples?: number[][];
    weightNames?: string[];
  },
): SmaaResult {
  const nSamples = opts?.nSamples ?? 10_000;
  const seed = opts?.seed ?? 42;
  const mode = opts?.mode ?? "dirichlet";
  const dispersionScale = opts?.dispersionScale ?? 1;

  let W: number[][];
  let crit: string[];
  if (opts?.weightSamples && opts.weightNames) {
    W = opts.weightSamples;
    crit = [...opts.weightNames];
  } else {
    const rng = createRng(seed);
    const sampled = sampleHierarchicalWeights(stats, nSamples, rng, {
      mode,
      dispersionScale,
      columns,
    });
    W = sampled.weights;
    crit = sampled.names;
  }

  const colIndex = new Map(columns.map((c, j) => [c, j]));
  const N = normalized.map((row) => crit.map((c) => row[colIndex.get(c)!]!));
  const nAlt = N.length;
  const nS = W.length;
  const scores: number[][] = Array.from({ length: nAlt }, () => Array(nS).fill(0));
  for (let i = 0; i < nAlt; i++) {
    for (let s = 0; s < nS; s++) {
      let acc = 0;
      for (let j = 0; j < crit.length; j++) acc += N[i]![j]! * W[s]![j]!;
      scores[i]![s] = acc;
    }
  }
  const ranks = ranksFromScores(scores);
  const acceptability = rankAcceptability(ranks);

  const central: Record<string, number> = {};
  for (let j = 0; j < crit.length; j++) {
    let s = 0;
    for (let t = 0; t < nS; t++) s += W[t]![j]!;
    central[crit[j]!] = s / nS;
  }
  const cSum = Object.values(central).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(central)) central[k] = central[k]! / cSum;

  return {
    alternatives: [...alternatives],
    criteria: crit,
    ranks,
    scores,
    acceptability,
    weightSamples: W,
    centralWeights: central,
    mode,
    nSamples: nS,
    seed,
    dispersionScale,
  };
}

/** Deterministic WSM scores for the centre weights (for comparison). */
export function deterministicWsmScores(
  normalized: readonly (readonly number[])[],
  columns: readonly string[],
  weights: HierarchicalWeights,
): number[] {
  return hierarchicalWsm(normalized, columns, weights);
}
