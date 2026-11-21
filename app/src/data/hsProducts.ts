/**
 * HS catalogue: HS2 chapters ship in the SPA (~12 KiB). Full HS4/HS6
 * nomenclature (~1.5 MiB) loads on demand from /meta/hs_nomenclature.json
 * so the main bundle stays small.
 */

import hs2Chapters from "./hs2Chapters.json";

export type HsProduct = {
  code: string;
  name: { en: string; es: string };
  /** Parent HS2 when HS4, or HS4 when HS6. */
  parent?: string;
};

type NomenclatureFile = {
  revision: string;
  hs2: HsProduct[];
  hs4?: HsProduct[];
  hs6?: HsProduct[];
  counts: { hs2: number; hs4: number; hs6: number };
};

const HS2_FILE = hs2Chapters as NomenclatureFile;

/** All HS2 chapters from BACI product_codes (96 chapters; HS 77 absent). */
export const HS2_PRODUCTS: HsProduct[] = HS2_FILE.hs2;

export const HS_NOMENCLATURE_REVISION = HS2_FILE.revision;
export const HS_NOMENCLATURE_COUNTS = HS2_FILE.counts;

type FullCatalog = {
  hs2: HsProduct[];
  hs4: HsProduct[];
  hs6: HsProduct[];
  all: HsProduct[];
  byCode: Map<string, HsProduct>;
};

let full: FullCatalog | null = null;
let loadPromise: Promise<FullCatalog> | null = null;

function buildCatalog(data: NomenclatureFile): FullCatalog {
  const hs2 = data.hs2?.length ? data.hs2 : HS2_PRODUCTS;
  const hs4 = data.hs4 ?? [];
  const hs6 = data.hs6 ?? [];
  const all = [...hs2, ...hs4, ...hs6];
  const byCode = new Map<string, HsProduct>();
  for (const p of all) byCode.set(p.code, p);
  return { hs2, hs4, hs6, all, byCode };
}

/** Seed full catalogue (tests). */
export function hydrateHsNomenclature(data: NomenclatureFile): void {
  full = buildCatalog(data);
  loadPromise = Promise.resolve(full);
}

export function resetHsNomenclatureForTests(): void {
  full = null;
  loadPromise = null;
}

function nomenclatureUrl(): string {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}meta/hs_nomenclature.json`;
}

/**
 * Fetch full HS4/HS6 nomenclature once. Safe to call from UI open handlers.
 * Idempotent; concurrent callers share one promise.
 */
export async function ensureFullHsNomenclature(): Promise<void> {
  if (full) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const res = await fetch(nomenclatureUrl(), {
        credentials: "same-origin",
        cache: "force-cache",
      });
      if (!res.ok) {
        throw new Error(`HS nomenclature HTTP ${res.status}`);
      }
      const data = (await res.json()) as NomenclatureFile;
      full = buildCatalog(data);
      return full;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  await loadPromise;
}

export function isFullHsNomenclatureReady(): boolean {
  return full != null;
}

export function getHs4Products(): HsProduct[] {
  return full?.hs4 ?? [];
}

export function getHs6Products(): HsProduct[] {
  return full?.hs6 ?? [];
}

export function getAllHsProducts(): HsProduct[] {
  return full?.all ?? HS2_PRODUCTS;
}

export type HsTreeNode = HsProduct & { children: HsProduct[] };

/** HS2 → HS4 tree (HS6 via search only — keeps the tree compact). */
export function hsCategoryTree(): HsTreeNode[] {
  const hs4 = full?.hs4 ?? [];
  return HS2_PRODUCTS.map((ch) => ({
    ...ch,
    children: hs4.filter((p) => p.parent === ch.code),
  }));
}

export const REGIONS: { id: string; name: { en: string; es: string } }[] = [
  { id: "world", name: { en: "World (demo set)", es: "Mundo (demo)" } },
  { id: "americas", name: { en: "Americas", es: "Américas" } },
  { id: "europe", name: { en: "Europe", es: "Europa" } },
  { id: "asia", name: { en: "Asia-Pacific", es: "Asia-Pacífico" } },
  { id: "africa", name: { en: "Africa & MENA", es: "África y MENA" } },
];

const REGION_ISO: Record<string, string[]> = {
  americas: [
    "USA",
    "CAN",
    "MEX",
    "BRA",
    "ARG",
    "CHL",
    "PER",
    "ECU",
    "URY",
  ],
  europe: [
    "DEU",
    "FRA",
    "GBR",
    "ITA",
    "ESP",
    "NLD",
    "BEL",
    "CHE",
    "AUT",
    "SWE",
    "NOR",
    "DNK",
    "FIN",
    "POL",
    "CZE",
    "PRT",
    "IRL",
    "GRC",
    "TUR",
    "RUS",
    "UKR",
  ],
  asia: [
    "CHN",
    "JPN",
    "KOR",
    "IND",
    "IDN",
    "THA",
    "VNM",
    "MYS",
    "SGP",
    "AUS",
    "NZL",
  ],
  africa: ["ZAF", "EGY", "MAR", "NGA", "KEN", "SAU", "ARE", "ISR", "IRQ"],
};

/**
 * Search HS2/HS4/HS6 by code or name.
 * Empty query returns HS2 chapters only (compact browse), never the full dump.
 * HS4/HS6 hits require {@link ensureFullHsNomenclature} first.
 */
export function searchHs(
  query: string,
  lang: "en" | "es",
  opts?: { limit?: number; emptyMeans?: "hs2" | "all" | "none" },
): HsProduct[] {
  const limit = opts?.limit ?? 40;
  const emptyMeans = opts?.emptyMeans ?? "hs2";
  const q = query.trim().toLowerCase();
  const pool = full?.all ?? HS2_PRODUCTS;
  if (!q) {
    if (emptyMeans === "none") return [];
    if (emptyMeans === "all") return pool.slice(0, limit);
    return HS2_PRODUCTS.slice(0, limit);
  }
  const out: HsProduct[] = [];
  for (const p of pool) {
    if (
      p.code.includes(q) ||
      p.name.en.toLowerCase().includes(q) ||
      p.name.es.toLowerCase().includes(q) ||
      p.name[lang].toLowerCase().includes(q)
    ) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function hsLabel(code: string, lang: "en" | "es"): string {
  const byCode = full?.byCode;
  const exact = byCode?.get(code) ?? HS2_PRODUCTS.find((p) => p.code === code);
  if (exact) return `${exact.code}: ${exact.name[lang]}`;
  const digits = code.replace(/\D/g, "");
  if (digits.length >= 2) {
    const hit =
      byCode?.get(digits.slice(0, 2)) ??
      HS2_PRODUCTS.find((p) => p.code === digits.slice(0, 2));
    if (hit) return `${code} (${hit.name[lang]})`;
  }
  return code;
}

export function filterByRegion(iso3: string[], region: string | undefined): string[] {
  if (!region || region === "world") return iso3;
  const allow = new Set(REGION_ISO[region] ?? []);
  if (allow.size === 0) return iso3;
  return iso3.filter((c) => allow.has(c));
}

/** HS2 prefix for any HS code length. */
export function hs2Of(code: string): string {
  const digits = code.replace(/\D/g, "");
  return digits.slice(0, 2);
}

const TOP_IMPORTER_HINTS: Record<string, string[]> = {
  "15": ["USA", "DEU", "ITA", "FRA", "GBR"],
  "64": ["USA", "DEU", "FRA", "GBR", "ITA", "ESP", "CHN"],
  "84": ["USA", "DEU", "CHN", "JPN", "MEX", "KOR"],
  "87": ["USA", "DEU", "CHN", "MEX", "CAN", "JPN"],
};

export function topImporterHints(hsCode: string): string[] {
  const hs2 = hs2Of(hsCode);
  return TOP_IMPORTER_HINTS[hs2] ?? [];
}

export const HS_TRADE_YEAR_MIN = 2012;
/**
 * Last complete BACI / panel observation year (freshness.latest_complete_year).
 * Analysis year t may exceed this via LOCF (year ≤ t); see {@link analysisYearMax}.
 */
export const HS_TRADE_YEAR_MAX = 2024;

/**
 * Max LOCF look-back (years) when resolving values at analysis year t.
 * Keep aligned with LOCF_MAX_LAG in projectPanel.ts.
 */
export const PANEL_LOCF_MAX_LAG = 5;

/** Cap for typed product-search hits in the scope picker (was hard-clamped to ~12). */
export const HS_SEARCH_HIT_LIMIT = 50;

export type AnalysisYearOpts = {
  /** Override calendar year (tests). Default: UTC full year. */
  nowYear?: number;
  /** Last observed panel/trade year. Default: {@link HS_TRADE_YEAR_MAX}. */
  panelMaxYear?: number;
  /** LOCF lag so the window still covers panelMax. */
  locfLag?: number;
};

/**
 * Highest selectable analysis year t.
 * SPEC: features at t use observations with year ≤ t (LOCF). Allow t up to the
 * current calendar year, but never past panelMax + locfLag (empty LOCF window).
 */
export function analysisYearMax(opts?: AnalysisYearOpts): number {
  const panelMax = opts?.panelMaxYear ?? HS_TRADE_YEAR_MAX;
  const lag = opts?.locfLag ?? PANEL_LOCF_MAX_LAG;
  const now =
    opts?.nowYear ??
    (typeof Date !== "undefined" ? new Date().getUTCFullYear() : panelMax);
  return Math.min(now, panelMax + lag);
}

/** Clamp analysis year into [HS_TRADE_YEAR_MIN, analysisYearMax]. */
export function clampTradeYear(year: number, opts?: AnalysisYearOpts): number {
  const max = analysisYearMax(opts);
  if (!Number.isFinite(year)) return max;
  return Math.min(max, Math.max(HS_TRADE_YEAR_MIN, Math.trunc(year)));
}

/** Descending year list for the scope year picker. */
export function tradeYearOptions(opts?: AnalysisYearOpts): number[] {
  const max = analysisYearMax(opts);
  const years: number[] = [];
  for (let y = max; y >= HS_TRADE_YEAR_MIN; y -= 1) years.push(y);
  return years;
}
