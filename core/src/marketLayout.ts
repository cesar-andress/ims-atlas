/**
 * VOSviewer-like market layout: SMACOF on normalised profiles + seeded k-means
 * + similarity edges for the network view (SPEC §12).
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

/** Undirected similarity link between destination indices (or iso3 pairs). */
export type MarketEdge = {
  source: string;
  target: string;
  /** Cosine similarity in [0, 1] after shifting (negative cosine → 0). */
  weight: number;
};

export type MarketLayoutResult = {
  nodes: MarketNode[];
  edges: MarketEdge[];
  stressHistory: number[];
  nClusters: number;
};

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom <= 0) return 0;
  return dot / denom;
}

/**
 * Build undirected top-k similarity edges from normalised profiles.
 * Deterministic: candidate order + sorted neighbour picks.
 */
export function buildSimilarityEdges(
  candidates: string[],
  normalized: number[][],
  opts?: { knn?: number; minWeight?: number },
): MarketEdge[] {
  const knn = opts?.knn ?? 3;
  const minWeight = opts?.minWeight ?? 0.05;
  const n = candidates.length;
  const seen = new Set<string>();
  const edges: MarketEdge[] = [];

  for (let i = 0; i < n; i++) {
    const sims: { j: number; w: number }[] = [];
    const rowI = normalized[i] ?? [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const raw = cosineSimilarity(rowI, normalized[j] ?? []);
      const w = Math.max(0, raw);
      if (w < minWeight) continue;
      sims.push({ j, w });
    }
    sims.sort((a, b) => b.w - a.w || a.j - b.j);
    for (const s of sims.slice(0, knn)) {
      const a = candidates[i]!;
      const b = candidates[s.j]!;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: a, target: b, weight: s.w });
    }
  }

  edges.sort(
    (a, b) =>
      b.weight - a.weight ||
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target),
  );
  return edges;
}

export function buildMarketLayout(input: {
  candidates: string[];
  /** Row-major normalised criteria matrix aligned with candidates. */
  normalized: number[][];
  ranking: { iso3: string; score: number; rank: number }[];
  k?: number;
  seed?: number;
  maxIterations?: number;
  /** Neighbours per node for network edges (default 3). */
  knn?: number;
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

  const edges = buildSimilarityEdges(input.candidates, input.normalized, {
    knn: input.knn ?? 3,
  });

  return {
    nodes,
    edges,
    stressHistory: layout.stressHistory,
    nClusters: k,
  };
}
