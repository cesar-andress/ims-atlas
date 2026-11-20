import type { MarketNode } from "@ims-atlas/core";

/** Short ES/EN labels for factors used in cluster naming (EXTRA-3). */
const FACTOR_LABEL: Record<string, { es: string; en: string }> = {
  demand: { es: "demanda", en: "demand" },
  cost_access: { es: "coste de acceso", en: "access cost" },
  logistics: { es: "logística", en: "logistics" },
  competition: { es: "competencia", en: "competition" },
  product_fit: { es: "encaje de producto", en: "product fit" },
  macro_risk: { es: "riesgo macro", en: "macro risk" },
  institutional: { es: "institucional", en: "institutional" },
  openness: { es: "apertura", en: "openness" },
  communication: { es: "comunicación", en: "communication" },
  entrepreneurship: { es: "emprendimiento", en: "entrepreneurship" },
  sustainability: { es: "sostenibilidad", en: "sustainability" },
  promotion: { es: "promoción", en: "promotion" },
};

/**
 * Label each cluster by the 2–3 factors with the highest mean score among
 * its members (plain characterisation for the similarity map).
 */
export function clusterDescriptors(
  nodes: readonly MarketNode[],
  factorScores: Readonly<Record<string, Readonly<Record<string, number>>>>,
  factors: readonly string[],
  topN = 2,
  lang: "es" | "en" = "es",
): Record<number, string> {
  const byCluster = new Map<number, string[]>();
  for (const n of nodes) {
    const list = byCluster.get(n.cluster) ?? [];
    list.push(n.iso3);
    byCluster.set(n.cluster, list);
  }
  const out: Record<number, string> = {};
  for (const [cluster, members] of byCluster) {
    if (factors.length === 0 || members.length === 0) {
      out[cluster] = lang === "es" ? `Grupo ${cluster}` : `Cluster ${cluster}`;
      continue;
    }
    const means = factors.map((f) => {
      let s = 0;
      let n = 0;
      for (const iso of members) {
        const v = factorScores[iso]?.[f];
        if (typeof v === "number" && Number.isFinite(v)) {
          s += v;
          n += 1;
        }
      }
      return { f, mean: n ? s / n : 0 };
    });
    means.sort((a, b) => b.mean - a.mean || a.f.localeCompare(b.f));
    const parts = means.slice(0, topN).map((m) => {
      const lab = FACTOR_LABEL[m.f];
      return lab ? lab[lang] : m.f;
    });
    const joined = parts.length ? parts.join(" · ") : `G${cluster}`;
    // Distinct prefix so legend does not repeat the same string three times.
    out[cluster] =
      lang === "es" ? `Grupo ${cluster}: ${joined}` : `Cluster ${cluster}: ${joined}`;
  }
  return out;
}
