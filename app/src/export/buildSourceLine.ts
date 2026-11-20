import type { CatalogVariable } from "../data/types";

/** Short citation line from the variables actually used in a chart (EXTRA-3). */
export function buildSourceLine(
  variables: readonly Pick<CatalogVariable, "id" | "source_ids" | "citation">[],
  sourceCitations: Readonly<Record<string, string>>,
  lang: "es" | "en",
): string {
  const ids = new Set<string>();
  for (const v of variables) {
    for (const sid of v.source_ids ?? []) ids.add(sid);
  }
  const cites = [...ids]
    .map((id) => sourceCitations[id])
    .filter((c): c is string => Boolean(c && c.trim()));
  const unique = [...new Set(cites)].slice(0, 4);
  if (unique.length === 0) {
    return lang === "es"
      ? "Fuentes: ver catálogo de variables"
      : "Sources: see variable catalogue";
  }
  const prefix = lang === "es" ? "Fuentes" : "Sources";
  return `${prefix}: ${unique.join("; ")}`;
}
