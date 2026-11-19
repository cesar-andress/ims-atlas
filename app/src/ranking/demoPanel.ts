/**
 * COL/HS64 demo panel loader.
 *
 * Product path (`meta/col_hs64_demo.json`) is either a pending stub (release empty)
 * or a future real release-backed panel. Synthetic goldens live only under
 * core/fixtures and app/e2e/fixtures and are injected by Playwright routes.
 */

import type { Direction, VariableSpec } from "@ims-atlas/core";

export type DemoPanel = {
  origin: string;
  hs: string;
  year: number;
  variables: VariableSpec[];
  candidates: string[];
  /** Raw values row-major aligned with variables. */
  values: (number | null)[][];
  /** Import volume proxy (IMPV) per candidate for min-imports filter. */
  importVolume: Record<string, number>;
  coveragePct: Record<string, number>;
  expectedExpertRanking: { iso3: string; score: number; rank: number }[];
  /** BYOD-only ids omitted from the public demo (gate). */
  excludedByod: { id: string; reason: string }[];
  notes: string[];
  synthetic: boolean;
};

export class DemoPanelPendingError extends Error {
  readonly code = "DATA_RELEASE_PENDING" as const;
  constructor(message: string) {
    super(message);
    this.name = "DemoPanelPendingError";
  }
}

type PendingFile = {
  status: "pending";
  message?: string;
  reason?: string;
};

type GoldenFile = {
  synthetic?: boolean;
  block: {
    origin: string;
    hs: string;
    year: number;
    variables: { id: string; factor: string; direction: Direction }[];
    candidates: string[];
    raw: Record<string, number | null | string>[];
    ranking_expert: { iso3: string; score: number; rank: number }[];
    notes?: string[];
    excluded_byod?: { id: string; reason: string }[];
  };
};

export const DEMO_PANEL_URL = "meta/col_hs64_demo.json";

let cache: DemoPanel | null = null;
let loadPromise: Promise<DemoPanel> | null = null;

export function isColHs64Preset(opts: {
  origin?: string;
  hs?: string;
  year?: number;
}): boolean {
  return opts.origin === "COL" && opts.hs === "64" && opts.year === 2023;
}

export function resetDemoPanelCache(): void {
  cache = null;
  loadPromise = null;
}

function panelFromBlock(block: GoldenFile["block"], synthetic: boolean): DemoPanel {
  const variables: VariableSpec[] = block.variables.map((v) => ({
    id: v.id,
    factor: v.factor,
    direction: v.direction,
  }));
  const columns = variables.map((v) => v.id);
  const values = block.raw.map((row) =>
    columns.map((id) => {
      const v = row[id];
      return typeof v === "number" ? v : null;
    }),
  );
  const importVolume: Record<string, number> = {};
  const coveragePct: Record<string, number> = {};
  for (const v of variables) {
    let present = 0;
    for (const row of block.raw) {
      if (typeof row[v.id] === "number") present++;
    }
    coveragePct[v.id] = (100 * present) / block.raw.length;
  }
  for (const row of block.raw) {
    const iso = String(row.iso3);
    const impv = row.IMPV;
    importVolume[iso] = typeof impv === "number" ? impv : 0;
  }
  return {
    origin: block.origin,
    hs: block.hs,
    year: block.year,
    variables,
    candidates: block.candidates,
    values,
    importVolume,
    coveragePct,
    expectedExpertRanking: block.ranking_expert,
    excludedByod: block.excluded_byod ?? [],
    notes: block.notes ?? [],
    synthetic,
  };
}

export async function loadDemoPanel(): Promise<DemoPanel> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}${DEMO_PANEL_URL}`);
    if (!res.ok) throw new Error(`Failed to load demo panel (${res.status})`);
    const payload = (await res.json()) as PendingFile | GoldenFile;
    if (
      payload &&
      typeof payload === "object" &&
      "status" in payload &&
      payload.status === "pending"
    ) {
      const msg =
        payload.message ??
        payload.reason ??
        "Data release pending — no redistributable COL/HS64 panel yet.";
      throw new DemoPanelPendingError(msg);
    }
    if (!("block" in payload) || !payload.block) {
      throw new DemoPanelPendingError("Data release pending");
    }
    cache = panelFromBlock(payload.block, Boolean(payload.synthetic));
    return cache;
  })();
  return loadPromise;
}
