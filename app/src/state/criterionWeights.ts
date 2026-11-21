/** Helpers for the Variables y pesos criterion cards (pure, unit-tested). */

export const FACTOR_LABELS: Record<string, { en: string; es: string }> = {
  demand: { en: "Demand", es: "Demanda" },
  cost_access: { en: "Cost and access", es: "Coste y acceso" },
  logistics: { en: "Logistics", es: "Logística" },
  competition: { en: "Competition", es: "Competencia" },
  product_fit: { en: "Product fit", es: "Ajuste del producto" },
  macro_risk: { en: "Macroeconomic risk", es: "Riesgo macroeconómico" },
  institutional: { en: "Institutional setting", es: "Entorno institucional" },
  openness: { en: "Trade openness", es: "Apertura comercial" },
  openness_legacy: { en: "Trade openness", es: "Apertura comercial" },
  communication: { en: "Communication", es: "Comunicación" },
  entrepreneurship: { en: "Entrepreneurship", es: "Emprendimiento" },
  sustainability: { en: "Sustainability", es: "Sostenibilidad" },
  promotion: { en: "Fairs and promotion", es: "Ferias y promoción" },
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

/**
 * Integer percents for UI that sum exactly to 100 (largest-remainder method).
 * Criteria with zero used variables are forced to 0% and excluded from the pot.
 */
export function displayWeightPercents(
  weights: Record<string, number>,
  varCount: Record<string, number>,
): Record<string, number> {
  const keys = Object.keys(weights);
  const out: Record<string, number> = {};
  const active = keys.filter((k) => (varCount[k] ?? 0) > 0);
  for (const k of keys) out[k] = 0;
  if (active.length === 0) return out;

  const mass = active.reduce((a, k) => a + Math.max(0, weights[k] ?? 0), 0);
  if (mass <= 0) {
    const eq = Math.floor(100 / active.length);
    let rem = 100 - eq * active.length;
    for (const k of active) {
      out[k] = eq + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    }
    return out;
  }

  const exact = active.map((k) => ({
    k,
    x: (Math.max(0, weights[k] ?? 0) / mass) * 100,
  }));
  const floors = exact.map(({ k, x }) => ({
    k,
    f: Math.floor(x),
    frac: x - Math.floor(x),
  }));
  const used = floors.reduce((a, r) => a + r.f, 0);
  let rem = 100 - used;
  floors.sort((a, b) => b.frac - a.frac || a.k.localeCompare(b.k));
  for (const row of floors) out[row.k] = row.f;
  for (let i = 0; i < floors.length && rem > 0; i++) {
    out[floors[i]!.k]! += 1;
    rem -= 1;
  }
  return out;
}

/** True when every shown criterion with vars>0 has weight>0 and percents sum to 100. */
export function weightsDisplayOk(
  weights: Record<string, number>,
  varCount: Record<string, number>,
  tol = 0.1,
): boolean {
  const pct = displayWeightPercents(weights, varCount);
  const sum = Object.values(pct).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > tol) return false;
  for (const k of Object.keys(weights)) {
    if ((varCount[k] ?? 0) > 0 && (pct[k] ?? 0) <= 0) return false;
  }
  return true;
}
