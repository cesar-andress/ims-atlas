/**
 * Phase A7 — pre-selection by imports (A) vs openness/CAE (B), HS levels, origin rule.
 */

import {
  preselectMarkets,
  type ImportRow,
  type PreselectionResult,
} from "./preselection.js";

export type HsLevel = 2 | 4 | 6;

export function parseHsCode(raw: string): {
  digits: string;
  level: HsLevel;
  label: string;
} {
  const cleaned = raw.replace(/\D/g, "");
  if (cleaned.length <= 2) {
    return { digits: cleaned.padStart(2, "0"), level: 2, label: cleaned };
  }
  if (cleaned.length <= 4) {
    return { digits: cleaned.padStart(4, "0"), level: 4, label: cleaned };
  }
  return {
    digits: cleaned.slice(0, 6).padStart(6, "0"),
    level: 6,
    label: cleaned.slice(0, 6),
  };
}

export function warnFewImportersAtHs6(
  nImporters: number,
  level: HsLevel,
  threshold = 10,
): string | null {
  if (level === 6 && nImporters < threshold) {
    return `HS-6 code has only ${nImporters} reporting importers (threshold ${threshold})`;
  }
  return null;
}

export type OpennessRow = { iso3: string; eoc: number };

/** Mode B: top N by CAE/openness. */
export function preselectByOpenness(input: {
  rows: readonly OpennessRow[];
  topN?: number;
}): { selected: string[]; ranked: OpennessRow[]; excluded: string[] } {
  const ranked = input.rows
    .filter((r) => Number.isFinite(r.eoc) && r.eoc > 0)
    .map((r) => ({ iso3: r.iso3.toUpperCase(), eoc: r.eoc }))
    .sort((a, b) => b.eoc - a.eoc || a.iso3.localeCompare(b.iso3));
  const n = Math.max(0, Math.floor(input.topN ?? 20));
  const selected = ranked.slice(0, n).map((r) => r.iso3);
  const excluded = ranked.slice(n).map((r) => r.iso3);
  return { selected, ranked, excluded };
}

export type DualPreselectResult = {
  byImports: PreselectionResult;
  byOpenness: { selected: string[]; excluded: string[] };
  overlap: string[];
  onlyImports: string[];
  onlyOpenness: string[];
  /** User pick: imports | openness | union */
  chosen: string[];
  exclusionReasons: Record<string, string>;
};

export function dualPreselect(input: {
  importRows: readonly ImportRow[];
  opennessRows: readonly OpennessRow[];
  importMode: "top_n" | "cumulative_share";
  topN?: number;
  cumulativeShare?: number;
  pick: "imports" | "openness" | "union";
  originIso3?: string;
  /** If true, origin may stay when present in lists (deliberate). */
  includeOrigin?: boolean;
}): DualPreselectResult {
  const byImports = preselectMarkets({
    rows: input.importRows,
    mode: input.importMode,
    ...(input.topN !== undefined ? { topN: input.topN } : {}),
    ...(input.cumulativeShare !== undefined
      ? { cumulativeShare: input.cumulativeShare }
      : {}),
  });
  const open = preselectByOpenness({
    rows: input.opennessRows,
    topN: input.topN ?? 20,
  });
  const setA = new Set(byImports.selected);
  const setB = new Set(open.selected);
  const overlap = [...setA].filter((x) => setB.has(x)).sort();
  const onlyImports = [...setA].filter((x) => !setB.has(x)).sort();
  const onlyOpenness = [...setB].filter((x) => !setA.has(x)).sort();
  let chosen: string[];
  if (input.pick === "imports") chosen = [...byImports.selected];
  else if (input.pick === "openness") chosen = [...open.selected];
  else chosen = [...new Set([...byImports.selected, ...open.selected])].sort();

  const origin = input.originIso3?.toUpperCase();
  if (origin && !input.includeOrigin) {
    chosen = chosen.filter((c) => c !== origin);
  }

  const exclusionReasons: Record<string, string> = {};
  const universe = new Set([
    ...byImports.universe,
    ...input.opennessRows.map((r) => r.iso3.toUpperCase()),
  ]);
  for (const iso of universe) {
    if (chosen.includes(iso)) continue;
    if (origin && iso === origin && !input.includeOrigin) {
      exclusionReasons[iso] = "origin excluded unless explicitly added";
      continue;
    }
    if (!setA.has(iso) && !setB.has(iso)) {
      exclusionReasons[iso] = "not in imports list A nor openness list B";
    } else if (!setA.has(iso)) {
      exclusionReasons[iso] = "excluded from imports pre-selection (A)";
    } else {
      exclusionReasons[iso] = "excluded from openness pre-selection (B)";
    }
  }

  return {
    byImports,
    byOpenness: { selected: open.selected, excluded: open.excluded },
    overlap,
    onlyImports,
    onlyOpenness,
    chosen,
    exclusionReasons,
  };
}
