/**
 * One-at-a-time weight tornado (±50% then renormalise).
 * Metric: mean absolute rank change vs baseline WSM ranks.
 */

import { hierarchicalWsm } from "./mcdm.js";
import type { HierarchicalWeights } from "./types.js";
import { validateWeights } from "./weights.js";

export type TornadoBar = {
  id: string;
  level: "factor" | "variable";
  /** Mean |Δrank| when weight × (1 − scale). */
  lowDelta: number;
  /** Mean |Δrank| when weight × (1 + scale). */
  highDelta: number;
};

function ranksFromScores(scores: readonly number[]): number[] {
  const order = scores
    .map((score, i) => ({ score, i }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const ranks = Array(scores.length).fill(0) as number[];
  order.forEach((o, r) => {
    ranks[o.i] = r + 1;
  });
  return ranks;
}

function meanAbsRankChange(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!);
  return s / a.length;
}

function scaleFactor(
  weights: HierarchicalWeights,
  factor: string,
  mult: number,
): HierarchicalWeights {
  const factors: Record<string, number> = { ...weights.factors };
  if (!(factor in factors)) return weights;
  factors[factor] = Math.max(0, factors[factor]! * mult);
  const total = Object.values(factors).reduce((x, y) => x + y, 0);
  if (total <= 0) return weights;
  for (const k of Object.keys(factors)) factors[k] = factors[k]! / total;
  return validateWeights({
    factors,
    variablesWithin: weights.variablesWithin,
    scheme: weights.scheme,
    notes: [...weights.notes, `tornado factor ${factor} ×${mult}`],
  });
}

function scaleVariable(
  weights: HierarchicalWeights,
  variableId: string,
  mult: number,
): HierarchicalWeights {
  const within: Record<string, Record<string, number>> = {};
  let touched = false;
  for (const [factor, vw] of Object.entries(weights.variablesWithin)) {
    if (!(variableId in vw)) {
      within[factor] = { ...vw };
      continue;
    }
    touched = true;
    const next: Record<string, number> = { ...vw };
    next[variableId] = Math.max(0, next[variableId]! * mult);
    const total = Object.values(next).reduce((x, y) => x + y, 0);
    if (total <= 0) {
      within[factor] = { ...vw };
      continue;
    }
    for (const k of Object.keys(next)) next[k] = next[k]! / total;
    within[factor] = next;
  }
  if (!touched) return weights;
  return validateWeights({
    factors: weights.factors,
    variablesWithin: within,
    scheme: weights.scheme,
    notes: [...weights.notes, `tornado variable ${variableId} ×${mult}`],
  });
}

/**
 * Tornado bars for each factor (and optionally each variable) at ±scale.
 * Default scale = 0.5 → ±50%.
 */
export function tornadoWeightSensitivity(
  normalized: readonly (readonly number[])[],
  columns: readonly string[],
  weights: HierarchicalWeights,
  opts?: { scale?: number; includeVariables?: boolean },
): TornadoBar[] {
  const scale = opts?.scale ?? 0.5;
  const includeVariables = opts?.includeVariables ?? false;
  const baseline = hierarchicalWsm(normalized, columns, weights);
  const baseRanks = ranksFromScores(baseline);

  const bars: TornadoBar[] = [];
  for (const factor of Object.keys(weights.factors).sort()) {
    const lowW = scaleFactor(weights, factor, 1 - scale);
    const highW = scaleFactor(weights, factor, 1 + scale);
    const lowRanks = ranksFromScores(hierarchicalWsm(normalized, columns, lowW));
    const highRanks = ranksFromScores(hierarchicalWsm(normalized, columns, highW));
    bars.push({
      id: factor,
      level: "factor",
      lowDelta: meanAbsRankChange(baseRanks, lowRanks),
      highDelta: meanAbsRankChange(baseRanks, highRanks),
    });
  }

  if (includeVariables) {
    for (const col of [...columns].sort()) {
      const lowW = scaleVariable(weights, col, 1 - scale);
      const highW = scaleVariable(weights, col, 1 + scale);
      const lowRanks = ranksFromScores(hierarchicalWsm(normalized, columns, lowW));
      const highRanks = ranksFromScores(hierarchicalWsm(normalized, columns, highW));
      bars.push({
        id: col,
        level: "variable",
        lowDelta: meanAbsRankChange(baseRanks, lowRanks),
        highDelta: meanAbsRankChange(baseRanks, highRanks),
      });
    }
  }

  bars.sort(
    (a, b) =>
      Math.max(b.lowDelta, b.highDelta) - Math.max(a.lowDelta, a.highDelta) ||
      a.id.localeCompare(b.id),
  );
  return bars;
}
