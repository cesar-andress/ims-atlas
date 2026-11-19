import { describe, expect, it } from "vitest";
import { kMeans2d } from "./cluster.js";
import {
  classicalMds2d,
  kruskalStress,
  layoutFromProfiles,
  pairwiseDistances,
  smacof2d,
} from "./mds.js";
import { buildMarketLayout } from "./marketLayout.js";

function makeBlock(n: number, p: number, seed: number): number[][] {
  // Deterministic synthetic profiles
  const out: number[][] = [];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 0x100000000;
  };
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < p; j++) row.push(rnd());
    out.push(row);
  }
  return out;
}

describe("SMACOF MDS", () => {
  it("stress decreases monotonically on a fixture", () => {
    const matrix = makeBlock(24, 8, 2023);
    const distances = pairwiseDistances(matrix);
    const result = smacof2d(distances, { maxIterations: 40 });
    expect(result.stressHistory.length).toBeGreaterThan(1);
    for (let i = 1; i < result.stressHistory.length; i++) {
      expect(result.stressHistory[i]!).toBeLessThanOrEqual(
        result.stressHistory[i - 1]! + 1e-10,
      );
    }
    expect(result.stressHistory[result.stressHistory.length - 1]!).toBeLessThan(
      result.stressHistory[0]!,
    );
  });

  it("layout is deterministic for the same input", () => {
    const matrix = makeBlock(20, 6, 64);
    const a = layoutFromProfiles(matrix);
    const b = layoutFromProfiles(matrix);
    expect(a.points).toEqual(b.points);
    expect(a.stressHistory).toEqual(b.stressHistory);
  });

  it("classical MDS recovers approximate 2D structure", () => {
    // Points on a line in 3D → distances nearly 1D
    const pts = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ];
    const d = pairwiseDistances(pts);
    const emb = classicalMds2d(d);
    expect(emb).toHaveLength(4);
    const stress = kruskalStress(emb, d);
    expect(stress).toBeLessThan(0.05);
  });
});

describe("seeded k-means", () => {
  it("is deterministic for a seed", () => {
    const points = Array.from({ length: 30 }, (_, i) => ({
      x: (i % 5) + i * 0.01,
      y: Math.floor(i / 5) + i * 0.02,
    }));
    const a = kMeans2d(points, 3, { seed: 99 });
    const b = kMeans2d(points, 3, { seed: 99 });
    expect(a.labels).toEqual(b.labels);
    expect(a.centroids).toEqual(b.centroids);
  });
});

describe("market layout", () => {
  it("assigns clusters and preserves ranking metadata", () => {
    const matrix = makeBlock(16, 5, 7);
    const candidates = matrix.map((_, i) => `C${i.toString().padStart(2, "0")}`);
    const ranking = candidates.map((iso3, i) => ({
      iso3,
      score: 1 - i * 0.01,
      rank: i + 1,
    }));
    const a = buildMarketLayout({
      candidates,
      normalized: matrix,
      ranking,
      k: 3,
      seed: 1,
    });
    const b = buildMarketLayout({
      candidates,
      normalized: matrix,
      ranking,
      k: 3,
      seed: 1,
    });
    expect(a.nodes).toEqual(b.nodes);
    expect(a.nodes.every((n) => n.cluster >= 0 && n.cluster < 3)).toBe(true);
    expect(a.stressHistory.length).toBeGreaterThan(0);
  });
});
