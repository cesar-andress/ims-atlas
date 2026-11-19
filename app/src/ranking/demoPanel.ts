/**
 * Demo panel for Phase 8 when the redistributable release has zero verified variables.
 * Source: imsfe-exported COL HS64 2023 golden (public/meta/phase8_col_hs64.json).
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
};

type GoldenFile = {
  block: {
    origin: string;
    hs: string;
    year: number;
    variables: { id: string; factor: string; direction: Direction }[];
    candidates: string[];
    raw: Record<string, number | null | string>[];
    ranking_expert: { iso3: string; score: number; rank: number }[];
  };
};

let cache: DemoPanel | null = null;
let loadPromise: Promise<DemoPanel> | null = null;

export function isColHs64Preset(opts: {
  origin?: string;
  hs?: string;
  year?: number;
}): boolean {
  return opts.origin === "COL" && opts.hs === "64" && opts.year === 2023;
}

export async function loadDemoPanel(): Promise<DemoPanel> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}meta/phase8_col_hs64.json`);
    if (!res.ok) throw new Error(`Failed to load demo panel (${res.status})`);
    const golden = (await res.json()) as GoldenFile;
    const block = golden.block;
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
    cache = {
      origin: block.origin,
      hs: block.hs,
      year: block.year,
      variables,
      candidates: block.candidates,
      values,
      importVolume,
      coveragePct,
      expectedExpertRanking: block.ranking_expert,
    };
    return cache;
  })();
  return loadPromise;
}
