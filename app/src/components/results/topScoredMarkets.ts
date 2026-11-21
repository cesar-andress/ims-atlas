/** Ranking rows that have a computable IMSFE score (finite). */
export function topScoredMarkets<T extends { score: number }>(
  ranking: readonly T[],
  n = 3,
): T[] {
  return ranking.filter((r) => Number.isFinite(r.score)).slice(0, n);
}
