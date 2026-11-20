/**
 * Podium-style weight inference: correlate the user's preferred market order
 * with each factor's score ranking (Spearman), then normalise positive rhos.
 */

function spearman(rankA: number[], rankB: number[]): number {
  const n = rankA.length;
  if (n < 2) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = rankA[i]! - rankB[i]!;
    sum += d * d;
  }
  return 1 - (6 * sum) / (n * (n * n - 1));
}

function ranksFromOrder(order: string[], universe: string[]): number[] {
  const pos = new Map(order.map((iso, i) => [iso, i + 1]));
  return universe.map((iso) => pos.get(iso) ?? order.length + 1);
}

function ranksFromScores(scores: Record<string, number>, universe: string[]): number[] {
  const sorted = [...universe].sort(
    (a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a.localeCompare(b),
  );
  const pos = new Map(sorted.map((iso, i) => [iso, i + 1]));
  return universe.map((iso) => pos.get(iso) ?? universe.length);
}

/** Preferred order is best-first (index 0 = favourite market). */
export function inferPodiumWeights(
  preferredOrder: readonly string[],
  factorScores: Readonly<Record<string, Readonly<Record<string, number>>>>,
  factors: readonly string[],
): Record<string, number> {
  const universe = preferredOrder.filter((iso) => factorScores[iso]);
  if (universe.length < 2 || factors.length === 0) {
    const eq = 1 / Math.max(1, factors.length);
    return Object.fromEntries(factors.map((f) => [f, eq]));
  }
  const userRanks = ranksFromOrder([...preferredOrder], universe);
  const raw: Record<string, number> = {};
  for (const f of factors) {
    const scores: Record<string, number> = {};
    for (const iso of universe) {
      scores[iso] = factorScores[iso]?.[f] ?? 0;
    }
    const rho = spearman(userRanks, ranksFromScores(scores, universe));
    raw[f] = Math.max(0, rho);
  }
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const eq = 1 / factors.length;
    return Object.fromEntries(factors.map((f) => [f, eq]));
  }
  return Object.fromEntries(factors.map((f) => [f, (raw[f] ?? 0) / sum]));
}
