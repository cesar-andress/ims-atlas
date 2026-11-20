/**
 * EXTRA-5 — data availability badges for Variables & weights.
 * Uses coverage_stats from status/variables.json (never invents values).
 */

import type { CatalogVariable } from "./types";

export type VariableDataKind = "complete" | "partial" | "none" | "team";

export type VariableDataStatus = {
  kind: VariableDataKind;
  /** Markets with data when known. */
  nCountries: number | null;
  yearMin: number | null;
  yearMax: number | null;
  coveragePct: number | null;
};

/** Prefer gate audience + coverage_stats; team-only when not public. */
export function variableDataStatus(
  v: CatalogVariable,
  opts?: { year?: number | null },
): VariableDataStatus {
  const year = opts?.year;
  const stats = v.coverage_stats;
  const n = stats?.n_countries ?? null;
  const y0 = stats?.year_min ?? null;
  const y1 = stats?.year_max ?? null;
  const pct = stats?.coverage_pct ?? null;
  const team =
    v.audience_public === false ||
    v.gate_decision === "byod_only" ||
    v.gate_decision === "local_only" ||
    v.redistributable === false;

  if (n == null || n <= 0) {
    return {
      kind: team ? "team" : "none",
      nCountries: n,
      yearMin: y0,
      yearMax: y1,
      coveragePct: pct,
    };
  }

  const yearOk =
    year == null ||
    y1 == null ||
    (y1 >= year - 3 && y1 <= year + 1) ||
    y1 >= year;

  let kind: VariableDataKind = "complete";
  if (pct != null && pct < 50) kind = "partial";
  else if (pct != null && pct < 80) kind = "partial";
  else if (!yearOk) kind = "partial";
  else if (n < 50) kind = "partial";

  if (team && kind === "none") {
    return { kind: "team", nCountries: n, yearMin: y0, yearMax: y1, coveragePct: pct };
  }
  if (team && kind !== "complete") {
    // Still show partial/none when coverage is weak; team lock is additive in UI.
  }

  return {
    kind: team && n <= 0 ? "team" : kind,
    nCountries: n,
    yearMin: y0,
    yearMax: y1,
    coveragePct: pct,
  };
}

/** Alias pairs that must not both carry weight (EXTRA-10). */
export const ALIAS_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["CLI", "PLI"],
  ["LPIN", "LPI"],
];

export function aliasCollisionIds(chosen: ReadonlySet<string>): string[] {
  const hits: string[] = [];
  for (const [a, b] of ALIAS_PAIRS) {
    if (chosen.has(a) && chosen.has(b)) hits.push(`${a}+${b}`);
  }
  // Also honour alias_of on catalogue rows when both ids are chosen.
  return hits;
}

export function aliasCollisionsFromCatalog(
  chosen: ReadonlySet<string>,
  catalog: readonly CatalogVariable[],
): string[] {
  const byId = new Map(catalog.map((v) => [v.id, v]));
  const hits = new Set(aliasCollisionIds(chosen));
  for (const id of chosen) {
    const v = byId.get(id);
    const target = v?.alias_of;
    if (target && chosen.has(target)) hits.add(`${id}+${target}`);
  }
  return [...hits].sort();
}
