/** Criterion colours (Okabe–Ito) and IMSFE 2025 factor ids. */

export const CRITERION_ORDER = [
  "COST",
  "LOGI",
  "COMM",
  "ECON",
  "POLI",
  "CULT",
] as const;

export type CriterionId = (typeof CRITERION_ORDER)[number];

export const CRITERION_COLOR: Record<CriterionId, string> = {
  COST: "var(--crit-cost)",
  LOGI: "var(--crit-logi)",
  COMM: "var(--crit-comm)",
  ECON: "var(--crit-econ)",
  POLI: "var(--crit-poli)",
  CULT: "var(--crit-cult)",
};

export const CRITERION_LABEL: Record<CriterionId, { en: string; es: string }> = {
  COST: { en: "Cost", es: "Coste" },
  LOGI: { en: "Logistics", es: "Logística" },
  COMM: { en: "Commercial", es: "Comercial" },
  ECON: { en: "Economic", es: "Económico" },
  POLI: { en: "Political", es: "Político" },
  CULT: { en: "Culture", es: "Cultura" },
};

export function isCriterionId(id: string): id is CriterionId {
  return (CRITERION_ORDER as readonly string[]).includes(id);
}
