/**
 * COL/HS64 panel loader.
 *
 * Public path (`meta/col_hs64_demo.json`) stays pending until verified ship vars.
 * Team path (`/datos-cerrados/meta/col_hs64_panel.json`) carries the live curated
 * panel when Authelia allows cerrada reads. Synthetic goldens stay under
 * core/fixtures and app/e2e/fixtures only.
 */

import type { Direction, VariableSpec } from "@ims-atlas/core";
import { loadAccessConfig } from "../auth/accessConfig";

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
export const CERRADA_PANEL_PATH = "/meta/col_hs64_panel.json";

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
    coveragePct[v.id] = (100 * present) / Math.max(1, block.raw.length);
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

function parsePanelPayload(payload: unknown): DemoPanel | null {
  if (!payload || typeof payload !== "object") return null;
  if ("status" in payload && (payload as PendingFile).status === "pending") {
    return null;
  }
  if (!("block" in payload) || !(payload as GoldenFile).block) return null;
  const file = payload as GoldenFile;
  return panelFromBlock(file.block, Boolean(file.synthetic));
}

async function tryFetchPanel(
  url: string,
  credentials: RequestCredentials,
): Promise<DemoPanel | null> {
  try {
    const res = await fetch(url, {
      credentials,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return parsePanelPayload(await res.json());
  } catch {
    return null;
  }
}

export async function loadDemoPanel(): Promise<DemoPanel> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const cfg = await loadAccessConfig();
      const base = cfg.auth.cerrada_base_path.replace(/\/$/, "");
      const cerrada = await tryFetchPanel(`${base}${CERRADA_PANEL_PATH}`, "include");
      if (cerrada && cerrada.candidates.length >= 20) {
        cache = cerrada;
        return cache;
      }
    } catch {
      // Anonymous or missing access config: fall through to public stub.
    }

    const publicUrl = `${import.meta.env.BASE_URL}${DEMO_PANEL_URL}`;
    const res = await fetch(publicUrl);
    if (!res.ok) throw new Error(`Failed to load demo panel (${res.status})`);
    const payload = (await res.json()) as PendingFile | GoldenFile;
    const parsed = parsePanelPayload(payload);
    if (parsed && parsed.candidates.length >= 20) {
      cache = parsed;
      return cache;
    }
    const msg =
      payload && typeof payload === "object" && "status" in payload
        ? ((payload as PendingFile).message ??
          (payload as PendingFile).reason ??
          "Faltan datos de comercio de BACI para 2023. Revise Datos → Estado.")
        : "Faltan datos de comercio de BACI para 2023. Revise Datos → Estado.";
    throw new DemoPanelPendingError(msg);
  })();
  return loadPromise;
}
