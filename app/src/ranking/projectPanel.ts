/**
 * Prompt 4a — mount a project panel from release parquet (DuckDB-WASM).
 * Origin / HS / year come from the user project, not from a fixed COL·64 file.
 */

import type { Direction, VariableSpec } from "@ims-atlas/core";
import { loadAccessConfig } from "../auth/accessConfig";
import { loadCatalogPreview } from "../data/catalogLoader";
import { dataConfig, resolvePublicReleaseBase } from "../dataConfig";
import { getAtlasDataClient } from "../data/duckdbClient";
import { clampTradeYear, PANEL_LOCF_MAX_LAG } from "../data/hsProducts";
import { escapeSqlLiteral, locfSelectSql, locfYears } from "../data/panelQueryHelpers";
import type { CatalogVariable } from "../data/types";
import {
  DemoPanelPendingError,
  type DemoPanel,
  resetDemoPanelCache,
} from "./demoPanel";

/** Keep in sync with {@link PANEL_LOCF_MAX_LAG} (analysis-year cap). */
const LOCF_MAX_LAG = PANEL_LOCF_MAX_LAG;
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
/** Hard block list (empty: César confirmed use_research for ecb_fx / vat_rates). */
const BLOCKED_SOURCE_IDS = new Set<string>();

export type ProjectPanelRequest = {
  origin?: string | undefined;
  hs?: string | undefined;
  year?: number | undefined;
};

type CacheEntry = { key: string; panel: DemoPanel; builtAt: number };
let cache: CacheEntry | null = null;

/** Short TTL so Authelia probe is not repeated on every weight tweak. */
let sessionCache: { at: number; base: string; team: boolean } | null = null;
const SESSION_TTL_MS = 60_000;

function hs2Of(hs: string): string {
  const digits = hs.replace(/\D/g, "");
  return digits.slice(0, 2).padStart(2, "0");
}

function escapeSql(value: string): string {
  return escapeSqlLiteral(value);
}

function ingestLocfRows(
  rows: Record<string, unknown>[],
  into: Map<string, { year: number; value: number }>,
  allowIso?: Set<string>,
): void {
  for (const row of rows) {
    const iso = String(row.iso3 ?? "");
    const vid = String(row.variable_id ?? "");
    const y = Number(row.year);
    const val = row.value == null ? null : Number(row.value);
    if (!iso || !vid || !Number.isFinite(y) || val == null || !Number.isFinite(val)) {
      continue;
    }
    if (allowIso && !allowIso.has(iso)) continue;
    into.set(`${iso}|${vid}`, { year: y, value: val });
  }
}

async function probeInternalVersion(ver: string): Promise<boolean> {
  const url = `/data/release/internal/v${ver}/country_year.parquet`;
  try {
    let probe = await fetch(url, {
      method: "HEAD",
      credentials: "include",
      cache: "no-store",
    });
    if (probe.ok) return true;
    probe = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Range: "bytes=0-3" },
    });
    return probe.ok || probe.status === 206;
  } catch {
    return false;
  }
}

/**
 * Prefer live `/data/release/internal/CURRENT`, then probe known pins.
 * Never return a version whose country_year.parquet 404s (stale config 1.1.0
 * while CURRENT points at 1.2.0 caused mono httpfs misses).
 */
async function resolveInternalVersion(): Promise<string> {
  const candidates: string[] = [];
  try {
    const res = await fetch("/data/release/internal/CURRENT", {
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const text = (await res.text()).trim().replace(/^v/, "");
      if (/^\d+\.\d+\.\d+$/.test(text)) candidates.push(text);
    }
  } catch {
    /* fall through */
  }
  for (const v of ["1.2.0", "1.1.0", dataConfig.release_version]) {
    if (!candidates.includes(v)) candidates.push(v);
  }
  for (const ver of candidates) {
    if (await probeInternalVersion(ver)) return ver;
  }
  return candidates[0] ?? dataConfig.release_version;
}

async function releaseBaseForSession(): Promise<{ base: string; team: boolean }> {
  const now = Date.now();
  if (sessionCache && now - sessionCache.at < SESSION_TTL_MS) {
    return { base: sessionCache.base, team: sessionCache.team };
  }
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
      const out = { base: `/data/release/internal/v${ver}`, team: true };
      sessionCache = { at: now, ...out };
      return out;
    }
  } catch {
    /* anonymous */
  }
  // Prefer a reachable /data/vX (skip CURRENT that was bumped before public promote).
  const publicBase = await resolvePublicReleaseBase();
  const out = { base: publicBase, team: false };
  sessionCache = { at: now, ...out };
  return out;
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
  if (!origin || !hs || req.year == null || !Number.isFinite(req.year)) {
    throw new DemoPanelPendingError("TEAM_RESULTS_PENDING");
  }
  // Analysis year t may exceed the BACI pin; LOCF uses observations with year ≤ t.
  const year = clampTradeYear(Number(req.year));

  const [{ base, team }, catalogPreview] = await Promise.all([
    releaseBaseForSession(),
    loadCatalogPreview(),
  ]);
  const key = `${origin}|${hs}|${year}|${base}`;
  if (cache && cache.key === key) return cache.panel;

  const catalog = new Map(catalogPreview.variables.map((v) => [v.id, v]));

  const client = getAtlasDataClient();
  await client.init();
  // country_year first (~0.8MB); bilateral (~2.5MB) overlaps product chapter fetch.
  await client.loadRelease({ basePath: base, includeBilateral: false });

  const hs2 = hs2Of(hs);
  const hsDigits = hs.replace(/\D/g, "");
  const hsLevel = hsDigits.length <= 2 ? "hs2" : hsDigits.length <= 4 ? "hs4" : "hs6";
  const hsCode = hsDigits.length <= 2 ? hs2 : hsDigits;
  const yearWindow = locfYears(Number(year), LOCF_MAX_LAG);
  const yearMin = yearWindow[0]!;

  // Prefer hive parts (public v1.1.0). Internal mono lacks index.json / some vars.
  const productBases = team ? [await resolvePublicReleaseBase(), base] : [base];

  async function loadProductChapter(): Promise<string> {
    for (const productBase of productBases) {
      let ok = await client.loadCountryProductChapter(hs2, {
        basePath: productBase,
        years: yearWindow,
        variableIds: [...PRODUCT_VAR_IDS],
      });
      if (!ok) {
        ok = await client.loadCountryProductChapter(hs2, {
          basePath: productBase,
          variableIds: [...PRODUCT_VAR_IDS],
        });
      }
      if (ok) return productBase;
    }
    throw new DemoPanelPendingError("TEAM_RESULTS_PENDING");
  }

  const [productBaseUsed] = await Promise.all([
    loadProductChapter(),
    client.loadRelease({ basePath: base, includeBilateral: true }),
  ]);

  const table = `country_product_hs2_${hs2}`;
  const productBest = new Map<string, { year: number; value: number }>();
  const productRows = await client.querySql(
    locfSelectSql({
      from: table,
      isoColumn: "iso3",
      yearMax: Number(year),
      yearMin,
      variableIds: PRODUCT_VAR_IDS,
      extraWhere: `hs_level = '${escapeSql(hsLevel)}' AND CAST(hs_code AS VARCHAR) = '${escapeSql(hsCode)}'`,
    }),
  );
  ingestLocfRows(productRows, productBest);

  const candidates = new Set<string>();
  for (const [k, cell] of productBest) {
    const [iso, vid] = k.split("|");
    if (vid === "IMPV" && cell.value > 0 && iso) candidates.add(iso);
  }
  if (candidates.size < 20) {
    throw new DemoPanelPendingError("TEAM_RESULTS_PENDING");
  }
  const candidateListSorted = [...candidates].sort();

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
      "WEO_GROWTH",
      "WEO_INFL",
      "WEO_GDPPC",
      "WEO_CA",
      "WEO_UNEMP",
    ]),
  ].filter((id) => metaFor(catalog, id));

  const countryBest = new Map<string, { year: number; value: number }>();
  if (countryWanted.length) {
    const countryRows = await client.querySql(
      locfSelectSql({
        from: "country_year",
        isoColumn: "iso3",
        yearMax: Number(year),
        yearMin,
        variableIds: countryWanted,
        isoFilter: candidateListSorted,
      }),
    );
    ingestLocfRows(countryRows, countryBest, candidates);
  }

  // Bilateral for origin → destination (filter destinations in SQL — never LIMIT 500000).
  const bilateralBest = new Map<string, { year: number; value: number }>();
  try {
    const bilRows = await client.querySql(
      locfSelectSql({
        from: "bilateral_year",
        isoColumn: "iso3_d",
        yearMax: Number(year),
        yearMin,
        variableIds: BILATERAL_VAR_IDS,
        isoFilter: candidateListSorted,
        extraWhere: `iso3_o = '${escapeSql(origin)}'`,
      }),
    );
    ingestLocfRows(bilRows, bilateralBest, candidates);
  } catch {
    bilateralBest.clear();
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

  const candidateList = candidateListSorted;
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
  if (productBaseUsed !== base) {
    notes.push(
      `Product chapter loaded from ${productBaseUsed} (session release ${base}).`,
    );
  }
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
  sessionCache = null;
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
