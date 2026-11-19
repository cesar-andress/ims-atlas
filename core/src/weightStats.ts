/**
 * Build SMAA ``WeightStats`` from a hierarchical weight centre (expert / equal / manual).
 * Dispersion defaults to relative sigma = 25% of each mean (floored).
 */

import type { HierarchicalWeights } from "./types.js";
import type { WeightStats } from "./smaa.js";

export function weightStatsFromHierarchical(
  weights: HierarchicalWeights,
  opts?: { relativeSigma?: number; minSigma?: number },
): WeightStats {
  const relativeSigma = opts?.relativeSigma ?? 0.25;
  const minSigma = opts?.minSigma ?? 0.02;
  const factorNames = Object.keys(weights.factors).sort();
  const factorMu = factorNames.map((f) => weights.factors[f]!);
  const factorSigma = factorMu.map((m) => Math.max(minSigma, m * relativeSigma));
  const factorMin = factorNames.map(() => 0);
  const factorMax = factorNames.map(() => 1);

  const within: WeightStats["within"] = {};
  for (const factor of factorNames) {
    const vw = weights.variablesWithin[factor] ?? {};
    const names = Object.keys(vw).sort();
    const mu = names.map((n) => vw[n]!);
    const sigma = mu.map((m) => Math.max(minSigma, m * relativeSigma));
    within[factor] = {
      names,
      mu,
      sigma,
      min: names.map(() => 0),
      max: names.map(() => 1),
    };
  }

  return {
    factorNames,
    factorMu,
    factorSigma,
    factorMin,
    factorMax,
    within,
  };
}
