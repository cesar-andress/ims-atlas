/**
 * Expert survey aggregation: means, min, max, sd. Respondents labelled Expert 1..n.
 */

export type ExpertCriterionWeights = Record<string, number>;
export type ExpertVariableWeights = Record<string, Record<string, number>>;

export type ExpertResponse = {
  /** Always "Expert k" — never real names. */
  label: string;
  criteria: ExpertCriterionWeights;
  variablesWithin: ExpertVariableWeights;
};

export type WeightStatsSummary = {
  mean: number;
  min: number;
  max: number;
  sd: number;
  n: number;
};

function sdSample(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function summarizeNumeric(xs: number[]): WeightStatsSummary {
  const finite = xs.filter((x) => Number.isFinite(x));
  if (finite.length === 0) {
    return { mean: Number.NaN, min: Number.NaN, max: Number.NaN, sd: 0, n: 0 };
  }
  return {
    mean: finite.reduce((a, b) => a + b, 0) / finite.length,
    min: Math.min(...finite),
    max: Math.max(...finite),
    sd: sdSample(finite),
    n: finite.length,
  };
}

export function validateUnitWeights(
  weights: Record<string, number>,
  tol = 1e-9,
): { ok: boolean; sum: number } {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return { ok: Math.abs(sum - 1) <= tol, sum };
}

export function aggregateExpertMeans(responses: readonly ExpertResponse[]): {
  criteria: Record<string, WeightStatsSummary>;
  variablesWithin: Record<string, Record<string, WeightStatsSummary>>;
  meanCriteria: Record<string, number>;
  meanVariablesWithin: Record<string, Record<string, number>>;
} {
  const critKeys = new Set<string>();
  const varKeys = new Map<string, Set<string>>();
  for (const r of responses) {
    for (const k of Object.keys(r.criteria)) critKeys.add(k);
    for (const [f, vars] of Object.entries(r.variablesWithin)) {
      if (!varKeys.has(f)) varKeys.set(f, new Set());
      for (const v of Object.keys(vars)) varKeys.get(f)!.add(v);
    }
  }

  const criteria: Record<string, WeightStatsSummary> = {};
  const meanCriteria: Record<string, number> = {};
  for (const k of critKeys) {
    const xs = responses.map((r) => r.criteria[k] ?? Number.NaN);
    const s = summarizeNumeric(xs);
    criteria[k] = s;
    meanCriteria[k] = s.mean;
  }

  const variablesWithin: Record<string, Record<string, WeightStatsSummary>> = {};
  const meanVariablesWithin: Record<string, Record<string, number>> = {};
  for (const [f, vars] of varKeys) {
    variablesWithin[f] = {};
    meanVariablesWithin[f] = {};
    for (const v of vars) {
      const xs = responses.map((r) => r.variablesWithin[f]?.[v] ?? Number.NaN);
      const s = summarizeNumeric(xs);
      variablesWithin[f]![v] = s;
      meanVariablesWithin[f]![v] = s.mean;
    }
  }

  return { criteria, variablesWithin, meanCriteria, meanVariablesWithin };
}

export function anonymizeExpertLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Expert ${i + 1}`);
}
