/**
 * Phase A3 — pure method checks that would have caught workbook issues F1–F11.
 * Each check returns structured warnings with ES/EN messages.
 */

import { normalizeMinmax, normalizeRank, normalizeRatioLegacy } from "../normalize.js";
import type { Direction } from "../types.js";
import { HOFSTEDE_DIMENSIONS, type HofstedeScores } from "./culturalDistance.js";

export type Lang = "en" | "es";

export type MethodWarning = {
  code: string;
  severity: "info" | "warn" | "error";
  message: Record<Lang, string>;
  detail?: Record<string, number | string | boolean>;
};

export type ZeroPolicy =
  | { kind: "epsilon"; epsilon: number }
  | { kind: "minmax" }
  | { kind: "rank" }
  | { kind: "offset_ratio"; c: number };

/** Apply a cost-variable zero policy before ratio scaling. */
export function applyZeroPolicy(
  series: readonly (number | null)[],
  policy: ZeroPolicy,
): (number | null)[] {
  if (policy.kind === "epsilon") {
    return series.map((v) => {
      if (v === null || !Number.isFinite(v)) return v;
      if (v === 0) return policy.epsilon;
      return v;
    });
  }
  if (policy.kind === "minmax") {
    return normalizeMinmax(series, "cost").map((v) => (Number.isFinite(v) ? v : null));
  }
  if (policy.kind === "rank") {
    return normalizeRank(series, "cost").map((v) => (Number.isFinite(v) ? v : null));
  }
  // offset_ratio: scaleMax handled by caller; here return x+c for ratio later
  return series.map((v) => {
    if (v === null || !Number.isFinite(v)) return v;
    return (v as number) + policy.c;
  });
}

/** Cost ratio with optional offset: scale * (min+c)/(x+c). */
export function normalizeImpOffset(
  series: readonly (number | null)[],
  c: number,
  scaleMax = 10,
): number[] {
  const shifted = series.map((v) =>
    v === null || !Number.isFinite(v) ? Number.NaN : (v as number) + c,
  );
  return normalizeRatioLegacy(shifted, "cost", scaleMax);
}

/**
 * Near-binary after IMP scaling: most values &lt; 1 and a few equal (≈) 10.
 */
export function detectNearBinaryScaled(
  scaled: readonly number[],
  variableId: string,
): MethodWarning | null {
  const finite = scaled.filter((v) => Number.isFinite(v));
  if (finite.length < 4) return null;
  const atTop = finite.filter((v) => v >= 9.5).length;
  const nearZero = finite.filter((v) => v < 1).length;
  if (atTop >= 1 && nearZero / finite.length >= 0.6) {
    return {
      code: "near_binary_scaled",
      severity: "warn",
      message: {
        es: `Variable casi binaria tras escalar (${variableId}): ${nearZero}/${finite.length} valores < 1 y ${atTop} ≈ 10. Compare otras políticas de ceros.`,
        en: `Near-binary variable after scaling (${variableId}): ${nearZero}/${finite.length} values < 1 and ${atTop} ≈ 10. Compare other zero policies.`,
      },
      detail: { variableId, nearZero, atTop, n: finite.length },
    };
  }
  return null;
}

/** How many ranks change between two score vectors (same country order). */
export function countRankChanges(
  scoresA: Record<string, number>,
  scoresB: Record<string, number>,
): number {
  const keys = Object.keys(scoresA).filter((k) => k in scoresB);
  const rank = (scores: Record<string, number>) => {
    const sorted = [...keys].sort(
      (a, b) => scores[b]! - scores[a]! || a.localeCompare(b),
    );
    const m = new Map<string, number>();
    sorted.forEach((k, i) => m.set(k, i + 1));
    return m;
  };
  const ra = rank(scoresA);
  const rb = rank(scoresB);
  let n = 0;
  for (const k of keys) {
    if (ra.get(k) !== rb.get(k)) n += 1;
  }
  return n;
}

export type CulturalDistanceKind = "sum_of_sums" | "sum_abs_diff" | "kogut_singh";

/**
 * Three cultural-distance definitions (F4).
 * - sum_of_sums: |Σ dest − Σ origin| (workbook reproduction)
 * - sum_abs_diff: Σ |d_i − o_i| (2018 paper / existing culturalDistance)
 * - kogut_singh: (1/n) Σ ((d_i − o_i)² / V_i) with variances over the pair set
 */
export function culturalDistanceByKind(
  origin: HofstedeScores,
  destination: HofstedeScores,
  kind: CulturalDistanceKind,
  variances?: Partial<Record<(typeof HOFSTEDE_DIMENSIONS)[number], number>>,
): number {
  if (kind === "sum_of_sums") {
    let so = 0;
    let sd = 0;
    for (const dim of HOFSTEDE_DIMENSIONS) {
      const a = origin[dim];
      const b = destination[dim];
      if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
      so += a;
      sd += b;
    }
    return Math.abs(sd - so);
  }
  if (kind === "sum_abs_diff") {
    let sum = 0;
    for (const dim of HOFSTEDE_DIMENSIONS) {
      const a = origin[dim];
      const b = destination[dim];
      if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
      sum += Math.abs(a - b);
    }
    return sum;
  }
  // kogut_singh
  let acc = 0;
  let n = 0;
  for (const dim of HOFSTEDE_DIMENSIONS) {
    const a = origin[dim];
    const b = destination[dim];
    const v = variances?.[dim];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
    const varDim = v !== undefined && v > 0 ? v : 1;
    acc += ((b - a) * (b - a)) / varDim;
    n += 1;
  }
  return n === 0 ? Number.NaN : acc / n;
}

export function warnSumOfSumsZeroDistance(
  origin: HofstedeScores,
  destination: HofstedeScores,
): MethodWarning | null {
  const workbook = culturalDistanceByKind(origin, destination, "sum_of_sums");
  const paper = culturalDistanceByKind(origin, destination, "sum_abs_diff");
  if (workbook === 0 && paper > 0) {
    return {
      code: "culture_sum_of_sums_zero",
      severity: "warn",
      message: {
        es: `Diferencia cultural por sumas = 0, pero la suma de |dimensiones| es ${paper}. Dos perfiles distintos pueden anularse.`,
        en: `Culture distance by sums = 0, but sum of |dimensions| is ${paper}. Distinct profiles can cancel.`,
      },
      detail: { workbook, paper },
    };
  }
  return null;
}

export function warnWeightsRenormalised(
  rawSum: number,
  label: string,
): MethodWarning | null {
  if (Math.abs(rawSum - 1) <= 1e-9) return null;
  return {
    code: "weights_renormalised",
    severity: "info",
    message: {
      es: `Pesos de ${label} suman ${rawSum.toFixed(6)} (≠ 1); se renormalizan.`,
      en: `${label} weights sum to ${rawSum.toFixed(6)} (≠ 1); renormalised.`,
    },
    detail: { rawSum, label },
  };
}

export function warnAggregatedRespondents(
  nExperts: number,
  labelledAs?: number,
): MethodWarning | null {
  if (nExperts !== 1) return null;
  const claimed = labelledAs ?? 1;
  return {
    code: "aggregated_respondents",
    severity: "warn",
    message: {
      es:
        claimed > 1
          ? `Respuesta agregada (${claimed} encuestados, 1 fila); dispersión desconocida.`
          : "Respuesta agregada, dispersión desconocida (1 fila de encuestado).",
      en:
        claimed > 1
          ? `Aggregated response (${claimed} respondents, 1 row); dispersion unknown.`
          : "Aggregated response, unknown dispersion (1 respondent row).",
    },
    detail: { nExperts, labelledAs: claimed },
  };
}

export type EocSeriesUnits = {
  tradeUnit: "usd" | "thousand_usd";
  gdpUnit: "usd" | "thousand_usd";
  definition: "goods_services" | "goods_only";
};

/** Raw EOC as percent: 100 * trade / GDP after aligning units. */
export function eocPercent(trade: number, gdp: number, units: EocSeriesUnits): number {
  if (!(gdp > 0) || !Number.isFinite(trade) || !Number.isFinite(gdp)) {
    return Number.NaN;
  }
  let t = trade;
  let g = gdp;
  if (units.tradeUnit === "thousand_usd" && units.gdpUnit === "usd") {
    t = trade * 1000;
  } else if (units.tradeUnit === "usd" && units.gdpUnit === "thousand_usd") {
    g = gdp * 1000;
  }
  return (100 * t) / g;
}

export function warnEocDefinition(units: EocSeriesUnits): MethodWarning {
  return {
    code: "eoc_definition",
    severity: "info",
    message: {
      es:
        units.definition === "goods_services"
          ? "CAE: bienes y servicios (p. ej. UNCTAD/WB)."
          : "CAE: solo bienes (p. ej. ITC); no mezclar con la definición de bienes y servicios.",
      en:
        units.definition === "goods_services"
          ? "EOC: goods and services (e.g. UNCTAD/WB)."
          : "EOC: goods only (e.g. ITC); do not mix with goods-and-services definition.",
    },
    detail: {
      tradeUnit: units.tradeUnit,
      gdpUnit: units.gdpUnit,
      definition: units.definition,
    },
  };
}

/** Suggest ISO3 from a country name (fuzzy); never auto-apply. */
export function suggestIso3(
  name: string,
  catalog: ReadonlyArray<{ name: string; iso3: string }>,
): { iso3: string; score: number } | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  let best: { iso3: string; score: number } | null = null;
  for (const row of catalog) {
    const c = row.name.trim().toLowerCase();
    let score = 0;
    if (c === n) score = 1;
    else if (c.includes(n) || n.includes(c)) score = 0.8;
    else if (n.replace(/\s+/g, "") === c.replace(/\s+/g, "")) score = 0.9;
    else if (
      (n === "turkey" && c === "türkiye") ||
      (n === "türkiye" && c === "turkey") ||
      (n === "viet nam" && c === "vietnam") ||
      (n === "vietnam" && c === "viet nam")
    ) {
      score = 0.95;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { iso3: row.iso3, score };
    }
  }
  return best;
}

/** Identical numeric rows under different country labels (F11 copy-paste). */
export function detectDuplicateNumericRows(
  rows: ReadonlyArray<{ country: string; values: readonly number[] }>,
): MethodWarning[] {
  const out: MethodWarning[] = [];
  const keyOf = (vals: readonly number[]) =>
    vals.map((v) => (Number.isFinite(v) ? v.toPrecision(12) : "na")).join("|");
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (row.values.length === 0) continue;
    const k = keyOf(row.values);
    const prev = seen.get(k);
    if (prev && prev !== row.country) {
      out.push({
        code: "duplicate_numeric_row",
        severity: "warn",
        message: {
          es: `Filas numéricas idénticas: «${prev}» y «${row.country}» (posible copia-pega).`,
          en: `Identical numeric rows: "${prev}" and "${row.country}" (possible copy-paste).`,
        },
        detail: { a: prev, b: row.country },
      });
    } else {
      seen.set(k, row.country);
    }
  }
  return out;
}

export function warnOutOfPlausibleRange(
  variableId: string,
  value: number,
  range: { min: number; max: number },
): MethodWarning | null {
  if (!Number.isFinite(value)) return null;
  if (value < range.min || value > range.max) {
    return {
      code: "out_of_range",
      severity: "warn",
      message: {
        es: `${variableId}=${value} fuera del rango plausible [${range.min}, ${range.max}].`,
        en: `${variableId}=${value} outside plausible range [${range.min}, ${range.max}].`,
      },
      detail: { variableId, value, min: range.min, max: range.max },
    };
  }
  return null;
}

/** IMP with ≤0 values: never Infinity; require an explicit choice. */
export function warnImpNonPositive(
  variableId: string,
  series: readonly (number | null)[],
): MethodWarning | null {
  const bad = series.filter(
    (v) => v !== null && Number.isFinite(v) && (v as number) <= 0,
  );
  if (bad.length === 0) return null;
  return {
    code: "imp_non_positive",
    severity: "error",
    message: {
      es: `${variableId}: ${bad.length} valor(es) ≤ 0 en variable de coste (IMP). Elija política de ceros; no se usa Infinity ni 0 silencioso.`,
      en: `${variableId}: ${bad.length} value(s) ≤ 0 in a cost (IMP) variable. Choose a zero policy; never Infinity or a silent 0.`,
    },
    detail: { variableId, n: bad.length },
  };
}

export function warnDiscontinuedSeries(
  variableId: string,
  lastYear: number,
): MethodWarning {
  return {
    code: "discontinued_series",
    severity: "warn",
    message: {
      es: `${variableId}: serie discontinuada (p. ej. Doing Business). Último año disponible: ${lastYear}.`,
      en: `${variableId}: discontinued series (e.g. Doing Business). Last year available: ${lastYear}.`,
    },
    detail: { variableId, lastYear },
  };
}

/**
 * Tables must be derived from one computed ranking — shuffling input row
 * order must not change country→score mapping (guards F1 paste misalignment).
 */
export function rankingTableConsistent(
  scores: Record<string, number>,
  rowOrder: readonly string[],
): { country: string; score: number; rank: number }[] {
  const rows = rowOrder
    .filter((c) => c in scores)
    .map((country) => ({ country, score: scores[country]! }));
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.country.localeCompare(b.country),
  );
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function messageFor(warning: MethodWarning, lang: Lang): string {
  return warning.message[lang];
}

/** Scale a cost series with an explicit policy (for side-by-side rank diffs). */
export function scaleCostWithPolicy(
  series: readonly (number | null)[],
  policy: ZeroPolicy,
  scaleMax = 10,
): number[] {
  if (policy.kind === "minmax") {
    return normalizeMinmax(series, "cost" satisfies Direction);
  }
  if (policy.kind === "rank") {
    return normalizeRank(series, "cost");
  }
  if (policy.kind === "offset_ratio") {
    return normalizeImpOffset(series, policy.c, scaleMax);
  }
  const prepared = applyZeroPolicy(series, policy);
  return normalizeRatioLegacy(prepared, "cost", scaleMax);
}
