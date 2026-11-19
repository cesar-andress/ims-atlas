/**
 * Phase E global search index (catalog, ISO3, HS, sources, projects).
 * Country hits are by ISO3 code only (no invented country-name tables).
 */

import { searchHs, type HsProduct } from "./hsProducts";
import { ISO3_EXPORTERS } from "./iso3Exporters";
import type { CatalogVariable } from "./types";
import type { ProjectListItem } from "../state/projectModel";

export type SearchGroup =
  | "countries"
  | "variables"
  | "hs"
  | "sources"
  | "projects";

export type SearchHit = {
  group: SearchGroup;
  id: string;
  label: string;
  sub?: string;
  /** Deep-link view + optional patches. */
  view:
    | "explore"
    | "data_variable"
    | "catalog"
    | "builder"
    | "country"
    | "projects"
    | "data_sources";
  focusVariable?: string;
  focusCountry?: string;
  hs?: string;
};

export type SearchIndex = {
  variables: CatalogVariable[];
  sources: { id: string; name?: string }[];
  projects: ProjectListItem[];
};

function varLabel(v: CatalogVariable, lang: "en" | "es"): string {
  if (typeof v.name === "string") return v.name;
  return lang === "es" ? v.name.es : v.name.en;
}

export function runGlobalSearch(
  query: string,
  index: SearchIndex,
  lang: "en" | "es",
  limitPerGroup = 8,
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];

  const countries = ISO3_EXPORTERS.filter((c) => c.toLowerCase().includes(q)).slice(
    0,
    limitPerGroup,
  );
  for (const iso of countries) {
    hits.push({
      group: "countries",
      id: iso,
      label: iso,
      sub: "ISO3",
      view: "country",
      focusCountry: iso,
    });
  }

  const vars = index.variables
    .filter((v) => {
      const name = varLabel(v, lang).toLowerCase();
      return (
        v.id.toLowerCase().includes(q) ||
        name.includes(q) ||
        v.factor.toLowerCase().includes(q) ||
        v.source_ids.some((s) => s.toLowerCase().includes(q))
      );
    })
    .slice(0, limitPerGroup);
  for (const v of vars) {
    hits.push({
      group: "variables",
      id: v.id,
      label: `${v.id} — ${varLabel(v, lang)}`,
      sub: v.factor,
      view: "data_variable",
      focusVariable: v.id,
    });
  }

  const hsHits: HsProduct[] = searchHs(query, lang).slice(0, limitPerGroup);
  for (const h of hsHits) {
    hits.push({
      group: "hs",
      id: h.code,
      label: `HS${h.code} — ${lang === "es" ? h.name.es : h.name.en}`,
      view: "builder",
      hs: h.code,
    });
  }

  const sources = index.sources
    .filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        (s.name ?? "").toLowerCase().includes(q),
    )
    .slice(0, limitPerGroup);
  for (const s of sources) {
    hits.push({
      group: "sources",
      id: s.id,
      label: s.name ? `${s.id} — ${s.name}` : s.id,
      view: "data_sources",
    });
  }

  const projects = index.projects
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.origin ?? "").toLowerCase().includes(q) ||
        (p.hs ?? "").includes(q),
    )
    .slice(0, limitPerGroup);
  for (const p of projects) {
    hits.push({
      group: "projects",
      id: p.id,
      label: p.name,
      sub: [p.origin, p.hs].filter(Boolean).join(" · "),
      view: "projects",
    });
  }

  return hits;
}

export const SEARCH_GROUP_ORDER: SearchGroup[] = [
  "variables",
  "countries",
  "hs",
  "sources",
  "projects",
];
