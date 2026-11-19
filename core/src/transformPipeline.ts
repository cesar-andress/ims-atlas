/**
 * Phase Z per-variable transform pipeline (fixed order, each step optional).
 * Direction is applied after scaling, never before.
 */

import {
  finiteValues,
  isFiniteNumber,
  mean,
  median,
  rankAverage,
  stdSample,
} from "./math.js";
import type { Direction } from "./types.js";

export type SkewTransform = "none" | "log" | "log1p";
export type OutlierTreatment = "none" | "winsor_1_99" | "winsor_5_95";
export type ScaleMethod = "ratio" | "minmax" | "zscore" | "robust_z" | "rank";
export type ReferenceSet = "candidates" | "all_countries" | "base_year";
export type YearPooling = "per_year" | "pooled";

export type ColumnPipelineConfig = {
  skew: SkewTransform;
  outlier: OutlierTreatment;
  scale: ScaleMethod;
  direction: Direction;
  /** Upper bound for ratio/minmax/rank (IMSFE 10, SMI 2018: 5). */
  scaleMax?: number;
};

export type PipelineStepId = "skew" | "outlier" | "scale" | "direction";

export type ColumnPipelineResult = {
  values: number[];
  /** True where winsorisation changed a finite cell. */
  winsorFlags: boolean[];
  stepsApplied: PipelineStepId[];
};

const MAD_SCALE = 1.4826;

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  const w = pos - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function applySkewTransform(
  series: readonly (number | null)[],
  skew: SkewTransform,
): number[] {
  return series.map((x) => {
    if (!isFiniteNumber(x)) return Number.NaN;
    if (skew === "none") return x;
    if (skew === "log") {
      return x > 0 ? Math.log(x) : Number.NaN;
    }
    // log1p: require x > -1
    return x > -1 ? Math.log1p(x) : Number.NaN;
  });
}

export function winsorize(
  series: readonly (number | null)[],
  treatment: OutlierTreatment,
): { values: number[]; flags: boolean[] } {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  const flags = vals.map(() => false);
  if (treatment === "none") {
    return { values: vals, flags };
  }
  const finite = finiteValues(vals).sort((a, b) => a - b);
  if (finite.length === 0) return { values: vals, flags };
  const loQ = treatment === "winsor_1_99" ? 0.01 : 0.05;
  const hiQ = treatment === "winsor_1_99" ? 0.99 : 0.95;
  const lo = quantile(finite, loQ);
  const hi = quantile(finite, hiQ);
  const out = vals.map((v, i) => {
    if (!Number.isFinite(v)) return Number.NaN;
    if (v < lo) {
      flags[i] = true;
      return lo;
    }
    if (v > hi) {
      flags[i] = true;
      return hi;
    }
    return v;
  });
  return { values: out, flags };
}

/** Scale treating higher raw as better (direction applied later). */
export function scaleBenefit(
  series: readonly (number | null)[],
  method: ScaleMethod,
  scaleMax = 10,
): number[] {
  const vals = series.map((x) => (isFiniteNumber(x) ? x : Number.NaN));
  const finite = finiteValues(vals);
  const scale = scaleMax > 0 ? scaleMax : 10;

  if (method === "ratio") {
    if (finite.length === 0) return vals.map(() => Number.NaN);
    const vmax = Math.max(...finite);
    if (!Number.isFinite(vmax) || vmax === 0) return vals.map(() => 0);
    return vals.map((v) => (Number.isFinite(v) ? (v / vmax) * scale : Number.NaN));
  }

  if (method === "minmax") {
    if (finite.length === 0) return vals.map(() => Number.NaN);
    const vmin = Math.min(...finite);
    const vmax = Math.max(...finite);
    const span = vmax - vmin;
    if (span === 0)
      return vals.map((v) => (Number.isFinite(v) ? scale / 2 : Number.NaN));
    return vals.map((v) =>
      Number.isFinite(v) ? ((v - vmin) / span) * scale : Number.NaN,
    );
  }

  if (method === "zscore") {
    if (finite.length === 0) return vals.map(() => Number.NaN);
    const mu = mean(finite);
    const sigma = finite.length > 1 ? stdSample(finite) : 0;
    return vals.map((v) => {
      if (!Number.isFinite(v)) return Number.NaN;
      if (sigma === 0) return 0;
      return (v - mu) / sigma;
    });
  }

  if (method === "robust_z") {
    if (finite.length === 0) return vals.map(() => Number.NaN);
    const med = median(finite);
    const absDev = finite.map((v) => Math.abs(v - med));
    const mad = median(absDev);
    const denom = mad === 0 ? 0 : mad * MAD_SCALE;
    return vals.map((v) => {
      if (!Number.isFinite(v)) return Number.NaN;
      if (denom === 0) return 0;
      return (v - med) / denom;
    });
  }

  // rank / percentile → 0..scaleMax
  const mask = vals.map((v) => Number.isFinite(v));
  const fin = vals.filter((_, i) => mask[i]) as number[];
  const n = fin.length;
  if (n === 0) return vals.map(() => Number.NaN);
  const ranks = rankAverage(fin);
  const out = vals.map(() => Number.NaN);
  let k = 0;
  for (let i = 0; i < vals.length; i++) {
    if (mask[i]) {
      out[i] = (ranks[k]! / n) * scale;
      k++;
    }
  }
  return out;
}

/** Flip cost criteria after benefit-oriented scaling. */
export function applyDirectionAfterScale(
  scaled: readonly number[],
  direction: Direction,
  method: ScaleMethod,
  scaleMax = 10,
): number[] {
  if (direction === "benefit") return [...scaled];
  const scale = scaleMax > 0 ? scaleMax : 10;
  if (method === "zscore" || method === "robust_z") {
    return scaled.map((v) => (Number.isFinite(v) ? -v : Number.NaN));
  }
  // Bounded scales: reflect around mid / max
  return scaled.map((v) => (Number.isFinite(v) ? scale - v : Number.NaN));
}

export function runColumnPipeline(
  series: readonly (number | null)[],
  config: ColumnPipelineConfig,
): ColumnPipelineResult {
  const stepsApplied: PipelineStepId[] = [];
  let values = applySkewTransform(series, config.skew);
  if (config.skew !== "none") stepsApplied.push("skew");

  const win = winsorize(values, config.outlier);
  values = win.values;
  if (config.outlier !== "none") stepsApplied.push("outlier");

  const scaleMax = config.scaleMax ?? 10;
  values = scaleBenefit(values, config.scale, scaleMax);
  stepsApplied.push("scale");

  values = applyDirectionAfterScale(values, config.direction, config.scale, scaleMax);
  stepsApplied.push("direction");

  return { values, winsorFlags: win.flags, stepsApplied };
}

export function describeReferenceSet(
  set: ReferenceSet,
  pooling: YearPooling,
): { en: string; es: string } {
  const setEn =
    set === "candidates"
      ? "candidate markets in this analysis"
      : set === "all_countries"
        ? "all countries in the release"
        : "the fixed base year";
  const setEs =
    set === "candidates"
      ? "mercados candidatos de este análisis"
      : set === "all_countries"
        ? "todos los países del release"
        : "el año base fijo";
  const poolEn =
    pooling === "per_year"
      ? "Statistics are computed per year (comparable within a year)."
      : "Statistics are pooled across years (needed for trends).";
  const poolEs =
    pooling === "per_year"
      ? "Las estadísticas se calculan por año (comparables dentro del año)."
      : "Las estadísticas se agrupan entre años (necesario para tendencias).";
  return {
    en: `Reference set: ${setEn}. ${poolEn}`,
    es: `Conjunto de referencia: ${setEs}. ${poolEs}`,
  };
}
