/**
 * Prompt 4a — mount a project panel from release parquet (DuckDB-WASM).
 * Origin / HS / year come from the user project, not from a fixed COL·64 file.
 */

import type { Direction, VariableSpec } from "@ims-atlas/core";
import { loadAccessConfig } from "../auth/accessConfig";
import { loadCatalogPreview } from "../data/catalogLoader";
import { dataConfig, releaseUrl } from "../dataConfig";
import { getAtlasDataClient } from "../data/duckdbClient";
import type { CatalogVariable } from "../data/types";
import {
  DemoPanelPendingError,
  type DemoPanel,
  resetDemoPanelCache,
} from "./demoPanel";

const LOCF_MAX_LAG = 5;
const PRODUCT_VAR_IDS = [
  "IMPV",
  "IMPC",
  "GRW",
  "HHI",
  "ASIASH",
  "REEXP",
  "UVGAP",
  "PPAD",
] as const;
const BILATERAL_VAR_IDS = ["DIST", "LANG", "FTA"] as const;
/** Sources César has not confirmed yet — never show their series in the panel. */
const BLOCKED_SOURCE_IDS = new Set(["ecb_fx", "vat_rates"]);

export type ProjectPanelRequest = {
  origin?: string | undefined;
  hs?: string | undefined;
  year?: number | undefined;
};

type CacheEntry = { key: string; panel: DemoPanel; builtAt: number };
let cache: CacheEntry | null = null;

function hs2Of(hs: string): string {
  const digits = hs.replace(/\D/g, "");
  return digits.slice(0, 2).padStart(2, "0");
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

async function resolveInternalVersion(): Promise<string> {
  try {
    const res = await fetch("/data/release/internal/CURRENT", {
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const text = (await res.text()).trim().replace(/^v/, "");
      if (/^\d+\.\d+\.\d+$/.test(text)) return text;
    }
  } catch {
    /* fall through */
  }
  return dataConfig.release_version;
}

async function releaseBaseForSession(): Promise<{ base: string; team: boolean }> {
  const publicBase = releaseUrl();
  try {
    const cfg = await loadAccessConfig();
    const cerrada = cfg.auth.cerrada_base_path.replace(/\/$/, "");
    // Auth check: any cerrada path behind Authelia. Do not depend on COL·HS64.
    const probe = await fetch(`${cerrada}/manifest.json`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
      redirect: "manual",
    });
    // Authelia: 200/404 = session reached cerrada; 302/401 = anonymous.
    const team = probe.ok || probe.status === 404;
    if (team) {
      const ver = await resolveInternalVersion();
      return { base: `/data/release/internal/v${ver}`, team: true };
    }
  } catch {
    /* anonymous */
  }
  return { base: publicBase, team: false };
}

function metaFor(
  catalog: Map<string, CatalogVariable>,
  id: string,
): VariableSpec | null {
  const v = catalog.get(id);
  if (!v) return null;
  const sources = v.source_ids ?? [];
  if (sources.some((s) => BLOCKED_SOURCE_IDS.has(s))) return null;
  const direction = (v.direction === "cost" ? "cost" : "benefit") as Direction;
  return { id, factor: v.factor || "macro_risk", direction };
}

/**
 * Build a DemoPanel for the active project scope from parquet tables.
 */
export async function loadProjectPanel(req: ProjectPanelRequest): Promise<DemoPanel> {
  const origin = (req.origin ?? "").trim().toUpperCase();
  const hs = (req.hs ?? "").trim();
  const year = req.year;
  if (!origin || !hs || year == null || !Number.isFinite(year)) {
    throw new DemoPanelPendingError("TEAM_RESULTS_PENDING");
  }

  const { base, team } = await releaseBaseForSession();
  const key = `${origin}|${hs}|${year}|${base}`;
  if (cache && cache.key === key) return cache.panel;

  const catalogPreview = await loadCatalogPreview();
  const catalog = new Map(catalogPreview.variables.map((v) => [v.id, v]));

  const client = getAtlasDataClient();
  await client.init();
  await client.loadRelease({ basePath: base });

  const hs2 = hs2Of(hs);
  const hsDigits = hs.replace(/\D/g, "");
  const hsLevel = hsDigits.length <= 2 ? "hs2" : hsDigits.length <= 4 ? "hs4" : "hs6";
  const hsCode = hsDigits.length <= 2 ? hs2 : hsDigits;

  const productOk = await client.loadCountryProductChapter(hs2, {
    basePath: base,
    year,
    variableIds: [...PRODUCT_VAR_IDS],
  });
  if (!productOk) {
    // Try without year filter (LOCF across product years).
    const anyYear = await client.loadCountryProductChapter(hs2, {
      basePath: base,
      variableIds: [...PRODUCT_VAR_IDS],
    });
    if (!anyYear) {
      throw new DemoPanelPendingError("TEAM_RESULTS_PENDING");
    }
  }

  const table = `country_product_hs2_${hs2}`;
  const productRows = await client.querySql(`
    SELECT iso3, year, variable_id, value
    FROM ${table}
    WHERE hs_level = '${escapeSql(hsLevel)}'
      AND CAST(hs_code AS VARCHAR) = '${escapeSql(hsCode)}'
      AND year <= ${Number(year)}
      AND year >= ${Number(year) - LOCF_MAX_LAG}
      AND variable_id IN (${PRODUCT_VAR_IDS.map((id) => `'${id}'`).join(",")})
  `);

  // LOCF per (iso3, variable_id): latest year <= project year.
  const productBest = new Map<string, { year: number; value: number }>();
  for (const row of productRows) {
    const iso = String(row.iso3 ?? "");
    const vid = String(row.variable_id ?? "");
    const y = Number(row.year);
    const val = row.value == null ? null : Number(row.value);
    if (!iso || !vid || !Number.isFinite(y) || val == null || !Number.isFinite(val)) {
      continue;
    }
    const k = `${iso}|${vid}`;
    const prev = productBest.get(k);
    if (!prev || y > prev.year) productBest.set(k, { year: y, value: val });
  }

  const candidates = new Set<string>();
  for (const [k, cell] of productBest) {
    const [iso, vid] = k.split("|");
    if (vid === "IMPV" && cell.value > 0 && iso) candidates.add(iso);
  }
  if (candidates.size < 20) {
    throw new DemoPanelPendingError("TEAM_RESULTS_PENDING");
  }

  // Country-year with LOCF (catalog ids that are not product/bilateral).
  const productSet = new Set<string>(PRODUCT_VAR_IDS);
  const bilateralSet = new Set<string>(BILATERAL_VAR_IDS);
  const countryWanted = [
    ...new Set([
      ...[...catalog.values()]
        .filter(
          (v) =>
            !productSet.has(v.id) &&
            !bilateralSet.has(v.id) &&
            !(v.source_ids ?? []).some((s) => BLOCKED_SOURCE_IDS.has(s)) &&
            (team || v.status === "verified" || v.redistributable === true),
        )
        .map((v) => v.id),
      "LPI",
      "PLI",
      "GDPPC",
      "CO2PC",
      "INFL",
      "UNEMP",
      "EOC",
      "CIBC",
      "CPTR",
      "GOV",
      "CC",
      "GE",
      "RQ",
      "RL",
      "PV",
      "VA",
      "EPI",
      "INRI",
      "CPIN",
      "GII",
      "FSIN",
      "GLIN",
    ]),
  ].filter((id) => metaFor(catalog, id));

  const countryRows = await client.querySql(`
    SELECT iso3, year, variable_id, value
    FROM country_year
    WHERE year <= ${Number(year)}
      AND year >= ${Number(year) - LOCF_MAX_LAG}
      AND variable_id IN (${countryWanted.map((id) => `'${escapeSql(id)}'`).join(",") || "''"})
  `);
  const countryBest = new Map<string, { year: number; value: number }>();
  for (const row of countryRows) {
    const iso = String(row.iso3 ?? "");
    const vid = String(row.variable_id ?? "");
    const y = Number(row.year);
    const val = row.value == null ? null : Number(row.value);
    if (!iso || !vid || !Number.isFinite(y) || val == null || !Number.isFinite(val)) {
      continue;
    }
    if (!candidates.has(iso)) continue;
    const k = `${iso}|${vid}`;
    const prev = countryBest.get(k);
    if (!prev || y > prev.year) countryBest.set(k, { year: y, value: val });
  }

  // Bilateral for origin → destination.
  let bilateralBest = new Map<string, { year: number; value: number }>();
  try {
    const bilRows = await client.querySql(`
      SELECT iso3_d AS iso3, year, variable_id, value
      FROM bilateral_year
      WHERE iso3_o = '${escapeSql(origin)}'
        AND year <= ${Number(year)}
        AND year >= ${Number(year) - LOCF_MAX_LAG}
        AND variable_id IN (${BILATERAL_VAR_IDS.map((id) => `'${id}'`).join(",")})
      LIMIT 500000
    `);
    bilateralBest = new Map();
    for (const row of bilRows) {
      const iso = String(row.iso3 ?? "");
      const vid = String(row.variable_id ?? "");
      const y = Number(row.year);
      const val = row.value == null ? null : Number(row.value);
      if (!iso || !vid || !candidates.has(iso)) continue;
      if (!Number.isFinite(y) || val == null || !Number.isFinite(val)) continue;
      const k = `${iso}|${vid}`;
      const prev = bilateralBest.get(k);
      if (!prev || y > prev.year) bilateralBest.set(k, { year: y, value: val });
    }
  } catch {
    bilateralBest = new Map();
  }

  const usedIds = new Set<string>();
  for (const k of productBest.keys()) usedIds.add(k.split("|")[1]!);
  for (const k of countryBest.keys()) usedIds.add(k.split("|")[1]!);
  for (const k of bilateralBest.keys()) usedIds.add(k.split("|")[1]!);

  const variables: VariableSpec[] = [];
  const dataYears: Record<string, number> = {};
  for (const id of [...PRODUCT_VAR_IDS, ...countryWanted, ...BILATERAL_VAR_IDS]) {
    if (!usedIds.has(id)) continue;
    const spec = metaFor(catalog, id);
    if (!spec) continue;
    if (variables.some((v) => v.id === id)) continue;
    variables.push(spec);
    // Representative data year (mode across markets).
    const years: number[] = [];
    for (const map of [productBest, countryBest, bilateralBest]) {
      for (const [k, cell] of map) {
        if (k.endsWith(`|${id}`)) years.push(cell.year);
      }
    }
    if (years.length) {
      years.sort((a, b) => a - b);
      dataYears[id] = years[Math.floor(years.length / 2)]!;
    }
  }

  if (variables.length < 6) {
    throw new DemoPanelPendingError("TEAM_RESULTS_PENDING");
  }

  const candidateList = [...candidates].sort();
  const values: (number | null)[][] = [];
  const importVolume: Record<string, number> = {};
  const coveragePct: Record<string, number> = {};
  for (const v of variables) coveragePct[v.id] = 0;

  for (const iso of candidateList) {
    const row: (number | null)[] = [];
    for (const v of variables) {
      const k = `${iso}|${v.id}`;
      const cell =
        productBest.get(k) ?? countryBest.get(k) ?? bilateralBest.get(k) ?? null;
      row.push(cell ? cell.value : null);
      if (cell) coveragePct[v.id] = (coveragePct[v.id] ?? 0) + 1;
      if (v.id === "IMPV" && cell) importVolume[iso] = cell.value;
    }
    values.push(row);
  }
  for (const v of variables) {
    coveragePct[v.id] =
      (100 * (coveragePct[v.id] ?? 0)) / Math.max(1, candidateList.length);
  }

  const notes: string[] = [
    `Project panel ${origin} · HS ${hs} · ${year} (${variables.length} variables).`,
  ];
  const lagged = Object.entries(dataYears).filter(([, y]) => y < year);
  if (lagged.length) {
    const sample = lagged
      .slice(0, 6)
      .map(([id, y]) => `${id}: ${y}`)
      .join(", ");
    notes.push(
      `Some series use an earlier year (max ${LOCF_MAX_LAG} years back): ${sample}.`,
    );
  }
  const yearSpan = Object.values(dataYears);
  if (yearSpan.length >= 2) {
    const span = Math.max(...yearSpan) - Math.min(...yearSpan);
    if (span >= 3) {
      notes.push(
        `Variable years span ${span} years; compare with care across indicators.`,
      );
    }
  }

  const ranking = candidateList
    .map((iso3) => ({
      iso3,
      score: importVolume[iso3] ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const panel: DemoPanel = {
    origin,
    hs: hsDigits || hs,
    year,
    variables,
    candidates: candidateList,
    values,
    importVolume,
    coveragePct,
    goldenImportOrder: ranking.slice(0, 50),
    excludedByod: [],
    notes,
    synthetic: false,
    illustrative: false,
  };

  cache = { key, panel, builtAt: Date.now() };
  return panel;
}

export function resetProjectPanelCache(): void {
  cache = null;
  resetDemoPanelCache();
}

/** Catalog ids present in a built panel (for tests / status). */
export function panelSourceCount(panel: DemoPanel, catalog: CatalogVariable[]): number {
  const byId = new Map(catalog.map((v) => [v.id, v]));
  const sources = new Set<string>();
  for (const v of panel.variables) {
    for (const s of byId.get(v.id)?.source_ids ?? []) sources.add(s);
  }
  return sources.size;
}
