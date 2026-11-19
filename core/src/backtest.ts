/**
 * Walk-forward backtest splits and block evaluation helpers (SPEC §5 / imsfe).
 */

import { baselineScores, type BaselineName } from "./baselines.js";
import { evaluateRanking } from "./metrics.js";
import { createRng } from "./rng.js";

export type TargetName = "intensive" | "new_markets" | "growth";

export type WalkForwardSplit = {
  firstTestYear: number;
  horizon: number;
  featureYearsAll: number[];
  trainFeatureYears: number[];
  testFeatureYears: number[];
};

export function makeWalkForwardSplit(
  years: readonly number[],
  opts: { firstTestYear: number; horizon: number },
): WalkForwardSplit {
  const featureYearsAll = [...new Set(years.map((y) => Math.trunc(y)))].sort(
    (a, b) => a - b,
  );
  const horizon = opts.horizon;
  const firstTestYear = opts.firstTestYear;
  const trainFeatureYears = featureYearsAll.filter((y) => y + horizon < firstTestYear);
  const ymax = featureYearsAll[featureYearsAll.length - 1] ?? firstTestYear;
  const testFeatureYears = featureYearsAll.filter(
    (y) => y >= firstTestYear && y + horizon <= ymax,
  );
  for (const y of trainFeatureYears) {
    if (y + horizon >= firstTestYear) {
      throw new Error(
        `leakage: train feature year ${y} has outcome year ${y + horizon} >= first_test_year ${firstTestYear}`,
      );
    }
  }
  for (const y of testFeatureYears) {
    if (y < firstTestYear) throw new Error(`test year ${y} < first_test_year`);
  }
  return {
    firstTestYear,
    horizon,
    featureYearsAll,
    trainFeatureYears,
    testFeatureYears,
  };
}

export type BacktestBlock = {
  origin: string;
  year: number;
  candidates: string[];
  /** Method scores: methodName -> iso3 -> score */
  methodScores: Record<string, Record<string, number>>;
  /** Outcomes for this horizon */
  yInt: Record<string, number>;
  yExt?: Record<string, number>;
  importVolume?: Record<string, number>;
  gravityScores?: Record<string, number>;
};

export type BlockMetricRow = {
  origin: string;
  year: number;
  method: string;
  family: "ims" | "baseline";
  target: TargetName;
  horizon: number;
  metrics: Record<string, number>;
};

/**
 * Evaluate IMS methods + baselines on one origin-year block.
 * Horizons k ∈ {1, 3}; targets intensive | new_markets | growth.
 */
export function evaluateBacktestBlock(
  block: BacktestBlock,
  opts: {
    horizon: number;
    target?: TargetName;
    baselines?: readonly BaselineName[];
    randomSeeds?: number;
    baseSeed?: number;
  },
): BlockMetricRow[] {
  const target = opts.target ?? "intensive";
  const baselines = opts.baselines ?? ["import_volume", "gravity", "random"];
  const rows: BlockMetricRow[] = [];
  const yExt =
    target === "intensive" && block.yExt !== undefined ? block.yExt : undefined;

  for (const [method, scores] of Object.entries(block.methodScores)) {
    const metrics = evaluateRanking(scores, {
      yInt: block.yInt,
      ...(yExt !== undefined ? { yExt } : {}),
    });
    rows.push({
      origin: block.origin,
      year: block.year,
      method,
      family: "ims",
      target,
      horizon: opts.horizon,
      metrics,
    });
  }

  for (const b of baselines) {
    if (b === "random") {
      const nSeeds = opts.randomSeeds ?? 100;
      const baseSeed = opts.baseSeed ?? 42;
      const acc: Record<string, number>[] = [];
      for (let s = 0; s < nSeeds; s++) {
        const rng = createRng(baseSeed + s);
        const scores = baselineScores(block.candidates, "random", { rng });
        acc.push(
          evaluateRanking(scores, {
            yInt: block.yInt,
            ...(yExt !== undefined ? { yExt } : {}),
          }),
        );
      }
      const keys = [...new Set(acc.flatMap((m) => Object.keys(m)))];
      const avg: Record<string, number> = {};
      for (const k of keys) {
        const vals = acc.map((m) => m[k]!).filter(Number.isFinite);
        avg[k] =
          vals.length === 0
            ? Number.NaN
            : vals.reduce((a, x) => a + x, 0) / vals.length;
      }
      rows.push({
        origin: block.origin,
        year: block.year,
        method: "random",
        family: "baseline",
        target,
        horizon: opts.horizon,
        metrics: avg,
      });
      continue;
    }
    const scores = baselineScores(block.candidates, b, {
      ...(block.importVolume !== undefined ? { importVolume: block.importVolume } : {}),
      ...(block.gravityScores !== undefined
        ? { gravityScores: block.gravityScores }
        : {}),
    });
    const metrics = evaluateRanking(scores, {
      yInt: block.yInt,
      ...(yExt !== undefined ? { yExt } : {}),
    });
    rows.push({
      origin: block.origin,
      year: block.year,
      method: b,
      family: "baseline",
      target,
      horizon: opts.horizon,
      metrics,
    });
  }
  return rows;
}
