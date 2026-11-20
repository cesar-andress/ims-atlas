/**
 * Catalogue for Fuentes y datos → Lista de variables.
 * Source of truth: status/variables.json (+ licences from status/sources.json).
 * Never fall back to the retired meta/catalog-preview.json draft.
 */

import type { CatalogPreview, CatalogVariable } from "./types";

function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}${path.replace(/^\//, "")}`;
}

function normalizeName(
  name: CatalogVariable["name"] | { en?: string; es?: string } | string | undefined,
  id: string,
): { en: string; es: string } {
  if (typeof name === "string") return { en: name, es: name };
  if (name && typeof name === "object") {
    return {
      en: name.en ?? id,
      es: name.es ?? name.en ?? id,
    };
  }
  return { en: id, es: id };
}

type StatusVariable = Record<string, unknown>;
type StatusSource = {
  id?: string;
  licence_id?: string | null;
  licence?: string | null;
  rights?: { licence_id?: string | null };
};

function licenceForVariable(
  varRow: StatusVariable,
  sourcesById: Map<string, StatusSource>,
): string[] {
  const existing = Array.isArray(varRow.licence_ids)
    ? varRow.licence_ids.map(String).filter(Boolean)
    : [];
  if (existing.length) return existing;
  const out: string[] = [];
  for (const sid of (varRow.source_ids as string[] | undefined) ?? []) {
    const src = sourcesById.get(String(sid));
    const lic =
      src?.licence_id ||
      src?.licence ||
      src?.rights?.licence_id ||
      null;
    if (lic && String(lic) !== "UNKNOWN") out.push(String(lic));
  }
  return out;
}

function coverageStats(
  varRow: StatusVariable,
): CatalogVariable["coverage_stats"] | undefined {
  const raw = varRow.coverage_stats;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const n = Number(o.n_countries ?? 0);
    if (n > 0) {
      return {
        n_countries: n,
        year_min: Number(o.year_min ?? 0) || undefined,
        year_max: Number(o.year_max ?? 0) || undefined,
        coverage_pct:
          o.coverage_pct === null || o.coverage_pct === undefined
            ? undefined
            : Number(o.coverage_pct),
      };
    }
  }
  const years = Array.isArray(varRow.years)
    ? (varRow.years as number[]).map(Number).filter((y) => Number.isFinite(y))
    : [];
  if (years.length >= 2) {
    return {
      n_countries: undefined,
      year_min: Math.min(...years),
      year_max: Math.max(...years),
      coverage_pct: undefined,
    };
  }
  return undefined;
}

function normalizeFromStatus(
  variablesPayload: { variables?: StatusVariable[] },
  sourcesPayload: { sources?: StatusSource[] },
): CatalogPreview {
  const sourcesById = new Map<string, StatusSource>();
  for (const s of sourcesPayload.sources ?? []) {
    if (s.id) sourcesById.set(String(s.id), s);
  }
  const variables: CatalogVariable[] = (variablesPayload.variables ?? []).map(
    (row) => {
      const id = String(row.id ?? "");
      const sourceIds = Array.isArray(row.source_ids)
        ? row.source_ids.map(String)
        : [];
      const gate = (row.gate as Record<string, unknown> | undefined) ?? {};
      const out: CatalogVariable = {
        id,
        name: normalizeName(row.name as CatalogVariable["name"], id),
        factor: String(row.factor ?? "unknown"),
        redistributable: Boolean(row.redistributable),
        source_ids: sourceIds,
        licence_ids: licenceForVariable(row, sourcesById),
        status: String(row.status ?? "draft"),
        gate_decision: gate.decision ? String(gate.decision) : undefined,
        audience_public: gate.included === true,
      };
      if (row.direction) out.direction = String(row.direction);
      if (Array.isArray(row.years)) out.years = row.years.map(Number);
      if (row.citation) out.citation = String(row.citation);
      if (row.alias_of) out.alias_of = String(row.alias_of);
      const stats = coverageStats(row);
      if (stats) out.coverage_stats = stats;
      if (row.notes) out.notes = String(row.notes);
      return out;
    },
  );
  const factors = [...new Set(variables.map((v) => v.factor))].sort();
  return {
    schema: "status-variables/v1",
    factors,
    variables,
    n_variables: variables.length,
  };
}

/** Load the live transparency catalogue (50 variables when ETL is published). */
export async function loadCatalogPreview(
  fetchImpl: typeof fetch = fetch,
): Promise<CatalogPreview> {
  try {
    const [varsRes, sourcesRes] = await Promise.all([
      fetchImpl(publicUrl("status/variables.json")),
      fetchImpl(publicUrl("status/sources.json")),
    ]);
    if (varsRes.ok) {
      const variablesPayload = (await varsRes.json()) as {
        variables?: StatusVariable[];
      };
      const sourcesPayload = sourcesRes.ok
        ? ((await sourcesRes.json()) as { sources?: StatusSource[] })
        : { sources: [] };
      const preview = normalizeFromStatus(variablesPayload, sourcesPayload);
      if (preview.variables.length > 0) return preview;
    }
  } catch {
    // fall through
  }

  return {
    schema: "empty",
    factors: [],
    variables: [],
    n_variables: 0,
    note: "Catalog unavailable",
  };
}
