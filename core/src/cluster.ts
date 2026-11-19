/**
 * Seeded k-means for market-map colouring (SPEC §5 / §6.6).
 */

import { createRng } from "./rng.js";
import type { Point2 } from "./mds.js";

export type KMeansResult = {
  labels: number[];
  centroids: Point2[];
  inertia: number;
};

function dist2(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * k-means on 2D points with deterministic k-means++ init (Mulberry32 seed).
 * Empty clusters are re-seeded from the farthest point.
 */
export function kMeans2d(
  points: readonly Point2[],
  k: number,
  opts: { seed?: number; maxIterations?: number } = {},
): KMeansResult {
  const n = points.length;
  if (n === 0) return { labels: [], centroids: [], inertia: 0 };
  const kk = Math.max(1, Math.min(k, n));
  const seed = opts.seed ?? 42;
  const maxIterations = opts.maxIterations ?? 50;
  const rng = createRng(seed);

  // k-means++
  const centroids: Point2[] = [];
  const first = rng.integers(0, n - 1);
  centroids.push({ ...points[first]! });
  while (centroids.length < kk) {
    const weights = points.map((p) => {
      let best = Infinity;
      for (const c of centroids) best = Math.min(best, dist2(p, c));
      return best;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let pick = n - 1;
    if (total <= 0) {
      pick = rng.integers(0, n - 1);
    } else {
      let r = rng.random() * total;
      for (let i = 0; i < n; i++) {
        r -= weights[i]!;
        if (r <= 0) {
          pick = i;
          break;
        }
      }
    }
    centroids.push({ ...points[pick]! });
  }

  const labels = new Array<number>(n).fill(0);
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < kk; c++) {
        const d = dist2(points[i]!, centroids[c]!);
        if (d < bestD || (d === bestD && c < best)) {
          bestD = d;
          best = c;
        }
      }
      if (labels[i] !== best) {
        labels[i] = best;
        changed = true;
      }
    }

    const sums = Array.from({ length: kk }, () => ({ x: 0, y: 0, n: 0 }));
    for (let i = 0; i < n; i++) {
      const c = labels[i]!;
      sums[c]!.x += points[i]!.x;
      sums[c]!.y += points[i]!.y;
      sums[c]!.n += 1;
    }
    for (let c = 0; c < kk; c++) {
      if (sums[c]!.n === 0) {
        // Re-seed empty cluster to farthest point from existing centroids
        let far = 0;
        let farD = -1;
        for (let i = 0; i < n; i++) {
          let dmin = Infinity;
          for (let j = 0; j < kk; j++) {
            if (j === c) continue;
            dmin = Math.min(dmin, dist2(points[i]!, centroids[j]!));
          }
          if (dmin > farD) {
            farD = dmin;
            far = i;
          }
        }
        centroids[c] = { ...points[far]! };
      } else {
        centroids[c] = {
          x: sums[c]!.x / sums[c]!.n,
          y: sums[c]!.y / sums[c]!.n,
        };
      }
    }
    if (!changed && iter > 0) break;
  }

  let inertia = 0;
  for (let i = 0; i < n; i++) {
    inertia += dist2(points[i]!, centroids[labels[i]!]!);
  }
  return { labels, centroids, inertia };
}
