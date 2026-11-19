/**
 * One-at-a-time weight sensitivity (2018 paper style): rescale others
 * proportionally and report the lower/upper weight before the winner changes.
 */

import { hierarchicalWsm } from "../mcdm.js";
import type { HierarchicalWeights } from "../types.js";

export type WinnerThreshold = {
  factor: string;
  baselineWeight: number;
  /** Weight below which a different market wins (or null if none in [0,1]). */
  lowerBeforeChange: number | null;
  upperBeforeChange: number | null;
  challengerAtLower: string | null;
  challengerAtUpper: string | null;
  baselineWinner: string;
};

function winnerOf(
  normalized: readonly (readonly number[])[],
  columns: readonly string[],
  candidates: readonly string[],
  weights: HierarchicalWeights,
): string {
  const scores = hierarchicalWsm(normalized, columns, weights);
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i]! > scores[best]!) best = i;
  }
  return candidates[best]!;
}

function withFactorWeight(
  base: HierarchicalWeights,
  factor: string,
  w: number,
): HierarchicalWeights {
  const factors = { ...base.factors };
  const others = Object.keys(factors).filter((f) => f !== factor);
  const rest = others.reduce((s, f) => s + (base.factors[f] ?? 0), 0);
  factors[factor] = w;
  const remain = Math.max(0, 1 - w);
  if (rest <= 0) {
    for (const f of others) factors[f] = 0;
  } else {
    for (const f of others) {
      factors[f] = ((base.factors[f] ?? 0) / rest) * remain;
    }
  }
  return {
    ...base,
    factors,
    scheme: "manual",
    notes: [...base.notes, `oat:${factor}=${w}`],
  };
}

export function oneAtATimeWinnerThresholds(input: {
  normalized: readonly (readonly number[])[];
  columns: readonly string[];
  candidates: readonly string[];
  weights: HierarchicalWeights;
  /** Grid resolution on [0,1]. */
  steps?: number;
}): WinnerThreshold[] {
  const steps = input.steps ?? 101;
  const baselineWinner = winnerOf(
    input.normalized,
    input.columns,
    input.candidates,
    input.weights,
  );
  const out: WinnerThreshold[] = [];

  for (const factor of Object.keys(input.weights.factors)) {
    const baselineWeight = input.weights.factors[factor] ?? 0;
    let lowerBeforeChange: number | null = null;
    let upperBeforeChange: number | null = null;
    let challengerAtLower: string | null = null;
    let challengerAtUpper: string | null = null;

    for (let s = 0; s < steps; s++) {
      const w = s / (steps - 1);
      const ww = withFactorWeight(input.weights, factor, w);
      const win = winnerOf(input.normalized, input.columns, input.candidates, ww);
      if (win !== baselineWinner) {
        if (w < baselineWeight) {
          lowerBeforeChange = w;
          challengerAtLower = win;
        } else if (w > baselineWeight && upperBeforeChange === null) {
          upperBeforeChange = w;
          challengerAtUpper = win;
          break;
        }
      }
    }

    out.push({
      factor,
      baselineWeight,
      lowerBeforeChange,
      upperBeforeChange,
      challengerAtLower,
      challengerAtUpper,
      baselineWinner,
    });
  }
  return out;
}
