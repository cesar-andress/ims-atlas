/** Helpers for the Variables y pesos criterion cards (pure, unit-tested). */

export const FACTOR_LABELS: Record<string, { en: string; es: string }> = {
  demand: { en: "Demand", es: "Demanda" },
  cost_access: { en: "Cost and access", es: "Coste y acceso" },
  logistics: { en: "Logistics", es: "Logística" },
  competition: { en: "Competition", es: "Competencia" },
  product_fit: { en: "Product fit", es: "Ajuste del producto" },
  macro_risk: { en: "Macroeconomic risk", es: "Riesgo macroeconómico" },
  institutional: { en: "Institutional setting", es: "Entorno institucional" },
  openness_legacy: { en: "Trade openness", es: "Apertura comercial" },
  sustainability: { en: "Sustainability", es: "Sostenibilidad" },
};

/**
 * Set one criterion to `share` (0..1) and rescale the others proportionally so
 * the total stays 1. When the others sum to zero they share the remainder equally.
 */
export function setOneWeight(
  weights: Record<string, number>,
  key: string,
  share: number,
): Record<string, number> {
  const keys = Object.keys(weights);
  if (!keys.includes(key)) return weights;
  const target = Math.min(1, Math.max(0, share));
  if (keys.length === 1) return { [key]: 1 };
  const others = keys.filter((k) => k !== key);
  const otherSum = others.reduce((a, k) => a + Math.max(0, weights[k] ?? 0), 0);
  const rest = 1 - target;
  const out: Record<string, number> = { [key]: target };
  for (const k of others) {
    out[k] =
      otherSum > 0
        ? (Math.max(0, weights[k] ?? 0) / otherSum) * rest
        : rest / others.length;
  }
  return Object.fromEntries(keys.map((k) => [k, out[k]!] as const));
}
