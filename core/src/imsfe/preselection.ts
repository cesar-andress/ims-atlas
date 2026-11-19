/**
 * Pre-selection funnel for IMSFE (import share / top-N / cumulative share).
 * Filters report how many markets they removed (never silent).
 */

export type ImportRow = {
  iso3: string;
  importValue: number;
};

export type PreselectMode = "top_n" | "cumulative_share";

export type PreselectFilterId =
  "importers_only" | "top_n" | "cumulative_share" | "manual_add" | "manual_remove";

export type FilterEffect = {
  id: PreselectFilterId;
  removed: string[];
  added: string[];
  remaining: number;
  note: string;
};

export type PreselectionResult = {
  universe: string[];
  importers: string[];
  selected: string[];
  shareByIso: Record<string, number>;
  cumulativeShare: Record<string, number>;
  effects: FilterEffect[];
  manualAdded: string[];
  manualRemoved: string[];
};

function positiveImporters(rows: readonly ImportRow[]): ImportRow[] {
  return rows
    .filter((r) => Number.isFinite(r.importValue) && r.importValue > 0)
    .map((r) => ({ iso3: r.iso3.toUpperCase(), importValue: r.importValue }));
}

export function preselectMarkets(input: {
  rows: readonly ImportRow[];
  mode: PreselectMode;
  topN?: number;
  cumulativeShare?: number;
  manualAdd?: readonly string[];
  manualRemove?: readonly string[];
}): PreselectionResult {
  const universe = [...new Set(input.rows.map((r) => r.iso3.toUpperCase()))].sort();
  const importers = positiveImporters(input.rows).sort(
    (a, b) => b.importValue - a.importValue || a.iso3.localeCompare(b.iso3),
  );
  const effects: FilterEffect[] = [];
  const importerIds = importers.map((r) => r.iso3);
  const nonImporters = universe.filter((id) => !importerIds.includes(id));
  effects.push({
    id: "importers_only",
    removed: nonImporters,
    added: [],
    remaining: importerIds.length,
    note: "Drop countries with non-positive import value",
  });

  const total = importers.reduce((s, r) => s + r.importValue, 0);
  const shareByIso: Record<string, number> = {};
  const cumulativeShare: Record<string, number> = {};
  let cum = 0;
  for (const row of importers) {
    const share = total > 0 ? row.importValue / total : 0;
    shareByIso[row.iso3] = share;
    cum += share;
    cumulativeShare[row.iso3] = cum;
  }

  let selected: string[] = [];
  if (input.mode === "top_n") {
    const n = Math.max(0, Math.floor(input.topN ?? 20));
    selected = importerIds.slice(0, n);
    effects.push({
      id: "top_n",
      removed: importerIds.slice(n),
      added: [],
      remaining: selected.length,
      note: `Keep top ${n} importers by value`,
    });
  } else {
    const thr = Math.min(1, Math.max(0, input.cumulativeShare ?? 0.8));
    selected = [];
    for (const id of importerIds) {
      selected.push(id);
      if ((cumulativeShare[id] ?? 0) >= thr) break;
    }
    effects.push({
      id: "cumulative_share",
      removed: importerIds.filter((id) => !selected.includes(id)),
      added: [],
      remaining: selected.length,
      note: `Keep importers until cumulative share ≥ ${thr}`,
    });
  }

  const manualRemoved = [
    ...new Set((input.manualRemove ?? []).map((x) => x.toUpperCase())),
  ].filter((id) => selected.includes(id));
  if (manualRemoved.length) {
    selected = selected.filter((id) => !manualRemoved.includes(id));
    effects.push({
      id: "manual_remove",
      removed: manualRemoved,
      added: [],
      remaining: selected.length,
      note: "Manual removals",
    });
  }

  const manualAdded = [
    ...new Set((input.manualAdd ?? []).map((x) => x.toUpperCase())),
  ].filter((id) => !selected.includes(id) && universe.includes(id));
  if (manualAdded.length) {
    selected = [...selected, ...manualAdded].sort();
    effects.push({
      id: "manual_add",
      removed: [],
      added: manualAdded,
      remaining: selected.length,
      note: "Manual additions",
    });
  }

  return {
    universe,
    importers: importerIds,
    selected,
    shareByIso,
    cumulativeShare,
    effects,
    manualAdded,
    manualRemoved,
  };
}
