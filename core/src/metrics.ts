/**
 * Ranking / classification metrics (ports ``imsfe.validation.metrics``).
 */

import { rankAverage } from "./math.js";

export type GainMode = "rank" | "clipped";

function align(
  score: Readonly<Record<string, number>>,
  y: Readonly<Record<string, number>>,
): { ids: string[]; a: number[]; b: number[] } {
  const ids: string[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (const id of Object.keys(score)) {
    const sv = score[id];
    const yv = y[id];
    if (
      sv !== undefined &&
      yv !== undefined &&
      Number.isFinite(sv) &&
      Number.isFinite(yv)
    ) {
      ids.push(id);
      a.push(sv);
      b.push(yv);
    }
  }
  return { ids, a, b };
}

/** Spearman ρ via Pearson on average ranks (matches scipy.stats.spearmanr). */
export function spearmanCorr(
  score: Readonly<Record<string, number>>,
  y: Readonly<Record<string, number>>,
): number {
  const { a, b } = align(score, y);
  if (a.length < 3) return Number.NaN;
  const ra = rankAverage(a);
  const rb = rankAverage(b);
  const n = ra.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = ra[i]! - ma;
    const xb = rb[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da === 0 || db === 0) return Number.NaN;
  return num / Math.sqrt(da * db);
}

function dcg(relevances: readonly number[], k: number): number {
  const rel = relevances.slice(0, k);
  if (rel.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < rel.length; i++) {
    s += rel[i]! / Math.log2(i + 2);
  }
  return s;
}

export function relevanceGains(
  yInt: Readonly<Record<string, number>>,
  mode: GainMode = "rank",
): Record<string, number> {
  const entries = Object.entries(yInt).filter(([, v]) => Number.isFinite(v));
  if (entries.length === 0) return {};
  if (mode === "clipped") {
    const out: Record<string, number> = {};
    for (const [id, v] of entries) out[id] = Math.max(0, v);
    return out;
  }
  const vals = entries.map(([, v]) => v);
  const ranks = rankAverage(vals);
  const out: Record<string, number> = {};
  entries.forEach(([id], i) => {
    out[id] = ranks[i]! / entries.length;
  });
  return out;
}

export function ndcgAtK(
  score: Readonly<Record<string, number>>,
  yInt: Readonly<Record<string, number>>,
  k = 10,
  gain: GainMode = "rank",
): number {
  const gains = relevanceGains(yInt, gain);
  const ids = Object.keys(score).filter(
    (id) =>
      Number.isFinite(score[id]) &&
      gains[id] !== undefined &&
      Number.isFinite(gains[id]),
  );
  if (ids.length === 0) return Number.NaN;
  const kEff = Math.min(k, ids.length);
  const ordered = [...ids].sort((a, b) => score[b]! - score[a]!);
  const orderedGains = ordered.map((id) => gains[id]!);
  const ideal = [...orderedGains].sort((a, b) => b - a);
  const idcg = dcg(ideal, kEff);
  if (idcg <= 0) return Number.NaN;
  return dcg(orderedGains, kEff) / idcg;
}

export function precisionAtK(
  score: Readonly<Record<string, number>>,
  yInt: Readonly<Record<string, number>>,
  k = 10,
): number {
  const ids = Object.keys(score).filter(
    (id) =>
      Number.isFinite(score[id]) && yInt[id] !== undefined && Number.isFinite(yInt[id]),
  );
  if (ids.length === 0) return Number.NaN;
  const kEff = Math.min(k, ids.length);
  const topScore = new Set(
    [...ids].sort((a, b) => score[b]! - score[a]!).slice(0, kEff),
  );
  const topY = new Set([...ids].sort((a, b) => yInt[b]! - yInt[a]!).slice(0, kEff));
  let inter = 0;
  for (const id of topScore) if (topY.has(id)) inter++;
  return inter / kEff;
}

/**
 * ROC AUC (sklearn.metrics.roc_auc_score for binary labels).
 * Mann–Whitney U formulation.
 */
export function aucExt(
  score: Readonly<Record<string, number>>,
  yExt: Readonly<Record<string, number>>,
): number {
  const { a, b } = align(score, yExt);
  const labels = new Set(b);
  if (a.length === 0 || labels.size < 2) return Number.NaN;
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (b[i] === 1) pos.push(a[i]!);
    else if (b[i] === 0) neg.push(a[i]!);
  }
  if (pos.length === 0 || neg.length === 0) return Number.NaN;
  // Average of pairwise indicators with 0.5 for ties
  let wins = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p > n) wins += 1;
      else if (p === n) wins += 0.5;
    }
  }
  return wins / (pos.length * neg.length);
}

export function evaluateRanking(
  score: Readonly<Record<string, number>>,
  opts?: {
    yInt?: Readonly<Record<string, number>>;
    yExt?: Readonly<Record<string, number>>;
    kNdcg?: readonly number[];
    kPrecision?: number;
    gain?: GainMode;
  },
): Record<string, number> {
  const out: Record<string, number> = {};
  if (opts?.yInt) {
    out.spearman = spearmanCorr(score, opts.yInt);
    for (const k of opts.kNdcg ?? [5, 10]) {
      out[`ndcg@${k}`] = ndcgAtK(score, opts.yInt, k, opts.gain ?? "rank");
    }
    out[`precision@${opts.kPrecision ?? 10}`] = precisionAtK(
      score,
      opts.yInt,
      opts.kPrecision ?? 10,
    );
  }
  if (opts?.yExt) {
    out.auc = aucExt(score, opts.yExt);
  }
  return out;
}
