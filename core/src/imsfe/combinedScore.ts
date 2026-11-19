/**
 * Phase A6 — combined IMSFE + EOC score and sensitivity grid.
 */

export type EocNormKind = "ratio_to_max" | "times_5";

export function normalizeImsfe(scores: Record<string, number>): Record<string, number> {
  const vals = Object.values(scores).filter((v) => Number.isFinite(v));
  const vmax = vals.length ? Math.max(...vals) : Number.NaN;
  if (!(vmax > 0)) {
    return Object.fromEntries(Object.keys(scores).map((k) => [k, Number.NaN]));
  }
  return Object.fromEntries(
    Object.entries(scores).map(([k, v]) => [
      k,
      Number.isFinite(v) ? (10 * v) / vmax : Number.NaN,
    ]),
  );
}

export function normalizeEoc(
  eoc: Record<string, number>,
  kind: EocNormKind = "ratio_to_max",
): { values: Record<string, number>; warnings: string[] } {
  const warnings: string[] = [];
  if (kind === "times_5") {
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(eoc)) {
      const n = Number.isFinite(v) ? 5 * v : Number.NaN;
      values[k] = n;
      if (n > 10) warnings.push(`EOC×5 exceeds 10 for ${k} (${n})`);
    }
    return { values, warnings };
  }
  return { values: normalizeImsfe(eoc), warnings };
}

/** combined = a * EOC_norm + b * IMSFE_norm with a+b=1. */
export function combinedScore(
  imsfeNorm: Record<string, number>,
  eocNorm: Record<string, number>,
  a: number,
): Record<string, number> {
  const b = 1 - a;
  const keys = new Set([...Object.keys(imsfeNorm), ...Object.keys(eocNorm)]);
  const out: Record<string, number> = {};
  for (const k of keys) {
    const i = imsfeNorm[k];
    const e = eocNorm[k];
    if (!Number.isFinite(i) || !Number.isFinite(e)) {
      out[k] = Number.NaN;
    } else {
      out[k] = a * (e as number) + b * (i as number);
    }
  }
  return out;
}

export const COMBINED_SPLITS = [0.3, 0.4, 0.5, 0.6, 0.7] as const;

export type CombinedGridRow = {
  a: number;
  b: number;
  ranks: Record<string, number>;
  top10: string[];
};

/** Small-multiples rank table for workbook splits 30/70 … 70/30. */
export function combinedRankGrid(
  imsfe: Record<string, number>,
  eoc: Record<string, number>,
  eocKind: EocNormKind = "ratio_to_max",
): { grid: CombinedGridRow[]; warnings: string[] } {
  const imsfeNorm = normalizeImsfe(imsfe);
  const { values: eocNorm, warnings } = normalizeEoc(eoc, eocKind);
  const grid: CombinedGridRow[] = [];
  for (const a of COMBINED_SPLITS) {
    const scores = combinedScore(imsfeNorm, eocNorm, a);
    const ranked = Object.entries(scores)
      .filter(([, v]) => Number.isFinite(v))
      .sort((x, y) => y[1]! - x[1]! || x[0].localeCompare(y[0]));
    const ranks: Record<string, number> = {};
    ranked.forEach(([k], i) => {
      ranks[k] = i + 1;
    });
    grid.push({
      a,
      b: 1 - a,
      ranks,
      top10: ranked.slice(0, 10).map(([k]) => k),
    });
  }
  return { grid, warnings };
}
