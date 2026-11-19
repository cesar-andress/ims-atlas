/**
 * Baseline scores for backtest comparison (ports ``imsfe.validation.backtest.baseline_scores``).
 */

import type { Rng } from "./rng.js";
import { createRng } from "./rng.js";

export type BaselineName = "import_volume" | "gravity" | "random";

/**
 * Build baseline scores for a fixed candidate set.
 * - import_volume: use provided IMPV values
 * - gravity: look up precomputed scores (missing → NaN)
 * - random: seeded uniforms in [0, 1)
 */
export function baselineScores(
  candidates: readonly string[],
  name: BaselineName,
  opts?: {
    importVolume?: Readonly<Record<string, number>>;
    gravityScores?: Readonly<Record<string, number>>;
    rng?: Rng;
    seed?: number;
  },
): Record<string, number> {
  const out: Record<string, number> = {};
  if (name === "import_volume") {
    const src = opts?.importVolume ?? {};
    for (const id of candidates) {
      const v = src[id];
      out[id] = v !== undefined && Number.isFinite(v) ? v : Number.NaN;
    }
    return out;
  }
  if (name === "gravity") {
    const src = opts?.gravityScores ?? {};
    for (const id of candidates) {
      const v = src[id];
      out[id] = v !== undefined && Number.isFinite(v) ? v : Number.NaN;
    }
    return out;
  }
  if (name === "random") {
    const rng = opts?.rng ?? createRng(opts?.seed ?? 0);
    for (const id of candidates) out[id] = rng.random();
    return out;
  }
  throw new Error(`Unknown baseline ${name}`);
}
