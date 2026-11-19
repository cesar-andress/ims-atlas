/**
 * Side-by-side ranking comparison under two normalisations (Phase Z lab).
 */

import { spearmanCorr } from "./metrics.js";

export type RankRow = { iso3: string; score: number; rank: number };

export type NormCompareResult = {
  spearman: number;
  top10Overlap: number;
  /** iso3 → rank_a − rank_b (negative = improved under B). */
  rankDelta: Record<string, number>;
  rows: {
    iso3: string;
    rankA: number;
    rankB: number;
    delta: number;
  }[];
};

export function compareRankings(
  a: readonly RankRow[],
  b: readonly RankRow[],
  topK = 10,
): NormCompareResult {
  const mapB = new Map(b.map((r) => [r.iso3, r]));
  const shared = a.filter((r) => mapB.has(r.iso3));
  const rankRecA: Record<string, number> = {};
  const rankRecB: Record<string, number> = {};
  for (const r of shared) {
    rankRecA[r.iso3] = r.rank;
    rankRecB[r.iso3] = mapB.get(r.iso3)!.rank;
  }
  const spearman = shared.length >= 2 ? spearmanCorr(rankRecA, rankRecB) : Number.NaN;

  const topA = new Set(
    [...a]
      .sort((x, y) => x.rank - y.rank)
      .slice(0, topK)
      .map((r) => r.iso3),
  );
  const topB = new Set(
    [...b]
      .sort((x, y) => x.rank - y.rank)
      .slice(0, topK)
      .map((r) => r.iso3),
  );
  let overlap = 0;
  for (const id of topA) if (topB.has(id)) overlap += 1;

  const rankDelta: Record<string, number> = {};
  const rows = shared.map((r) => {
    const rb = mapB.get(r.iso3)!;
    const delta = r.rank - rb.rank;
    rankDelta[r.iso3] = delta;
    return { iso3: r.iso3, rankA: r.rank, rankB: rb.rank, delta };
  });
  rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  return {
    spearman,
    top10Overlap: overlap / topK,
    rankDelta,
    rows,
  };
}

export function topBottom(
  candidates: readonly string[],
  values: readonly number[],
  n = 5,
): {
  top: { iso3: string; value: number }[];
  bottom: { iso3: string; value: number }[];
} {
  const pairs = candidates
    .map((iso3, i) => ({ iso3, value: values[i]! }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => b.value - a.value);
  return {
    top: pairs.slice(0, n),
    bottom: [...pairs].reverse().slice(0, n),
  };
}
