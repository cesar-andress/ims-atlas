/**
 * VOSviewer-like market layout: SMACOF on normalised profiles + seeded k-means.
 */

import { kMeans2d } from "./cluster.js";
import { layoutFromProfiles, type Point2 } from "./mds.js";

export type MarketNode = {
  iso3: string;
  x: number;
  y: number;
  score: number;
  rank: number;
  cluster: number;
};

export type MarketLayoutResult = {
  nodes: MarketNode[];
  stressHistory: number[];
  nClusters: number;
};

export function buildMarketLayout(input: {
  candidates: string[];
  /** Row-major normalised criteria matrix aligned with candidates. */
  normalized: number[][];
  ranking: { iso3: string; score: number; rank: number }[];
  k?: number;
  seed?: number;
  maxIterations?: number;
}): MarketLayoutResult {
  const k = input.k ?? 4;
  const seed = input.seed ?? 42;
  const layout = layoutFromProfiles(input.normalized, {
    maxIterations: input.maxIterations ?? 80,
  });
  const km = kMeans2d(layout.points, k, { seed });
  const rankByIso = new Map(input.ranking.map((r) => [r.iso3, r]));

  const nodes: MarketNode[] = input.candidates.map((iso3, i) => {
    const r = rankByIso.get(iso3);
    const p: Point2 = layout.points[i] ?? { x: 0, y: 0 };
    return {
      iso3,
      x: p.x,
      y: p.y,
      score: r?.score ?? 0,
      rank: r?.rank ?? i + 1,
      cluster: km.labels[i] ?? 0,
    };
  });

  return {
    nodes,
    stressHistory: layout.stressHistory,
    nClusters: k,
  };
}
