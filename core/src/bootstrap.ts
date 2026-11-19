/**
 * Paired bootstrap lift with percentile 95% CI (ports imsfe bootstrap helpers).
 */

import { createRng, type Rng } from "./rng.js";
import type { BlockMetricRow } from "./backtest.js";

export type BootstrapSummary = {
  method: string;
  metric: string;
  mean: number;
  ci95Low: number;
  ci95High: number;
  nBlocks: number;
};

export type PairedDelta = {
  contrast: string;
  method: string;
  baseline: string;
  metric: string;
  deltaMean: number;
  ci95Low: number;
  ci95High: number;
  nBlocks: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function nanMean(vals: readonly number[]): number {
  const finite = vals.filter(Number.isFinite);
  if (finite.length === 0) return Number.NaN;
  return finite.reduce((a, b) => a + b, 0) / finite.length;
}

function blockKeys(
  rows: readonly BlockMetricRow[],
): { origin: string; year: number }[] {
  const seen = new Set<string>();
  const out: { origin: string; year: number }[] = [];
  for (const r of rows) {
    const k = `${r.origin}|${r.year}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ origin: r.origin, year: r.year });
    }
  }
  return out;
}

function metricByBlock(
  rows: readonly BlockMetricRow[],
  method: string,
  metric: string,
  blocks: readonly { origin: string; year: number }[],
): number[] {
  return blocks.map((b) => {
    const row = rows.find(
      (r) => r.method === method && r.origin === b.origin && r.year === b.year,
    );
    const v = row?.metrics[metric];
    return v !== undefined && Number.isFinite(v) ? v : Number.NaN;
  });
}

export function bootstrapMethodSummary(
  rows: readonly BlockMetricRow[],
  opts?: {
    metric?: string;
    nReps?: number;
    seed?: number;
    alpha?: number;
    rng?: Rng;
  },
): BootstrapSummary[] {
  const metric = opts?.metric ?? "ndcg@10";
  const nReps = opts?.nReps ?? 2000;
  const alpha = opts?.alpha ?? 0.05;
  const rng = opts?.rng ?? createRng(opts?.seed ?? 42);
  const blocks = blockKeys(rows);
  const nBlocks = blocks.length;
  const methods = [...new Set(rows.map((r) => r.method))].sort();
  const out: BootstrapSummary[] = [];
  for (const method of methods) {
    const vals = metricByBlock(rows, method, metric, blocks);
    const observed = nanMean(vals);
    const boots: number[] = [];
    for (let r = 0; r < nReps; r++) {
      const sample: number[] = [];
      for (let i = 0; i < nBlocks; i++) {
        const idx = rng.integers(0, nBlocks - 1);
        sample.push(vals[idx]!);
      }
      boots.push(nanMean(sample));
    }
    const sorted = [...boots].filter(Number.isFinite).sort((a, b) => a - b);
    out.push({
      method,
      metric,
      mean: observed,
      ci95Low: percentile(sorted, alpha / 2),
      ci95High: percentile(sorted, 1 - alpha / 2),
      nBlocks: vals.filter(Number.isFinite).length,
    });
  }
  return out;
}

export function bootstrapPairedDeltas(
  rows: readonly BlockMetricRow[],
  opts?: {
    methods?: readonly string[];
    baselines?: readonly string[];
    metric?: string;
    nReps?: number;
    seed?: number;
    rng?: Rng;
  },
): PairedDelta[] {
  const metric = opts?.metric ?? "ndcg@10";
  const nReps = opts?.nReps ?? 2000;
  const baselines = opts?.baselines ?? ["import_volume", "gravity", "random"];
  const rng = opts?.rng ?? createRng(opts?.seed ?? 42);
  const blocks = blockKeys(rows);
  const present = new Set(rows.map((r) => r.method));
  const methods =
    opts?.methods ?? [...present].filter((m) => !baselines.includes(m)).sort();
  const out: PairedDelta[] = [];
  for (const method of methods) {
    if (!present.has(method)) continue;
    const mVals = metricByBlock(rows, method, metric, blocks);
    for (const baseline of baselines) {
      if (!present.has(baseline)) continue;
      const bVals = metricByBlock(rows, baseline, metric, blocks);
      const deltas = mVals.map((m, i) =>
        Number.isFinite(m) && Number.isFinite(bVals[i]) ? m - bVals[i]! : Number.NaN,
      );
      const obs = nanMean(deltas);
      const boots: number[] = [];
      const nBlocks = deltas.length;
      for (let r = 0; r < nReps; r++) {
        const sample: number[] = [];
        for (let i = 0; i < nBlocks; i++) {
          sample.push(deltas[rng.integers(0, nBlocks - 1)]!);
        }
        boots.push(nanMean(sample));
      }
      const sorted = [...boots].filter(Number.isFinite).sort((a, b) => a - b);
      out.push({
        contrast: `${method} - ${baseline}`,
        method,
        baseline,
        metric,
        deltaMean: obs,
        ci95Low: percentile(sorted, 0.025),
        ci95High: percentile(sorted, 0.975),
        nBlocks: deltas.filter(Number.isFinite).length,
      });
    }
  }
  return out;
}
