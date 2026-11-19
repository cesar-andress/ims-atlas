import { releaseUrl } from "../dataConfig";
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

function normalizeCatalog(raw: unknown): CatalogPreview {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const variablesIn = Array.isArray(obj.variables) ? obj.variables : [];
  const variables: CatalogVariable[] = variablesIn.map((v) => {
    const row = v as Record<string, unknown>;
    const id = String(row.id ?? "");
    const sourceIds = Array.isArray(row.source_ids)
      ? row.source_ids.map(String)
      : [];
    const licenceIds = Array.isArray(row.licence_ids)
      ? row.licence_ids.map(String)
      : sourceIds.map(() => "UNKNOWN");
    const out: CatalogVariable = {
      id,
      name: normalizeName(row.name as CatalogVariable["name"], id),
      factor: String(row.factor ?? "unknown"),
      redistributable: Boolean(row.redistributable),
      source_ids: sourceIds,
      licence_ids: licenceIds,
    };
    if (row.direction) out.direction = String(row.direction);
    if (row.status) out.status = String(row.status);
    if (Array.isArray(row.years)) out.years = row.years.map(Number);
    if (row.citation) out.citation = String(row.citation);
    if (row.coverage_demo) {
      out.coverage_demo = row.coverage_demo as CatalogVariable["coverage_demo"];
    }
    return out;
  });
  const preview: CatalogPreview = {
    schema: String(obj.schema ?? "catalog"),
    factors: Array.isArray(obj.factors) ? obj.factors.map(String) : [],
    variables,
    n_variables: variables.length,
  };
  if (obj.note) preview.note = String(obj.note);
  return preview;
}

/**
 * Prefer the published release catalog when it has variables; otherwise the
 * bundled draft preview (full SPEC §4 list for UI / BYOD planning).
 */
export async function loadCatalogPreview(
  fetchImpl: typeof fetch = fetch,
): Promise<CatalogPreview> {
  let preview: CatalogPreview | null = null;
  try {
    const res = await fetchImpl(publicUrl("meta/catalog-preview.json"));
    if (res.ok) preview = normalizeCatalog(await res.json());
  } catch {
    preview = null;
  }

  try {
    const releaseRes = await fetchImpl(releaseUrl("catalog.json"));
    if (releaseRes.ok) {
      const released = normalizeCatalog(await releaseRes.json());
      if (released.variables.length > 0) {
        if (preview) {
          const byId = new Map(preview.variables.map((v) => [v.id, v]));
          released.variables = released.variables.map((v) => {
            const p = byId.get(v.id);
            if (!p) return v;
            const merged: CatalogVariable = {
              ...v,
              licence_ids: v.licence_ids.length ? v.licence_ids : p.licence_ids,
            };
            if (v.coverage_demo) merged.coverage_demo = v.coverage_demo;
            else if (p.coverage_demo) merged.coverage_demo = p.coverage_demo;
            return merged;
          });
        }
        return released;
      }
    }
  } catch {
    // fall through
  }

  if (preview) return preview;
  return {
    schema: "empty",
    factors: [],
    variables: [],
    n_variables: 0,
    note: "Catalog unavailable",
  };
}
