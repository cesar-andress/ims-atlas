/** HS2/HS4/HS6 catalogue for search + category tree (BACI nomenclature). */

import nomenclature from "./hsNomenclature.json";

export type HsProduct = {
  code: string;
  name: { en: string; es: string };
  /** Parent HS2 when HS4, or HS4 when HS6. */
  parent?: string;
};

type NomenclatureFile = {
  revision: string;
  hs2: HsProduct[];
  hs4: HsProduct[];
  hs6: HsProduct[];
  counts: { hs2: number; hs4: number; hs6: number };
};

const DATA = nomenclature as NomenclatureFile;

/** All HS2 chapters from BACI product_codes (96 chapters; HS 77 absent). */
export const HS2_PRODUCTS: HsProduct[] = DATA.hs2;

/** HS4 headings derived from BACI HS6 codes. */
export const HS4_PRODUCTS: HsProduct[] = DATA.hs4;

/** HS6 leaves from BACI product_codes (English labels; ES falls back to EN). */
export const HS6_PRODUCTS: HsProduct[] = DATA.hs6;

export const ALL_HS_PRODUCTS: HsProduct[] = [
  ...HS2_PRODUCTS,
  ...HS4_PRODUCTS,
  ...HS6_PRODUCTS,
];

export const HS_NOMENCLATURE_REVISION = DATA.revision;
export const HS_NOMENCLATURE_COUNTS = DATA.counts;

const BY_CODE = new Map<string, HsProduct>();
for (const p of ALL_HS_PRODUCTS) BY_CODE.set(p.code, p);

export type HsTreeNode = HsProduct & { children: HsProduct[] };

/** HS2 → HS4 tree (HS6 via search only — keeps the tree compact). */
export function hsCategoryTree(): HsTreeNode[] {
  return HS2_PRODUCTS.map((ch) => ({
    ...ch,
    children: HS4_PRODUCTS.filter((p) => p.parent === ch.code),
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
 */
export function searchHs(
  query: string,
  lang: "en" | "es",
  opts?: { limit?: number; emptyMeans?: "hs2" | "all" | "none" },
): HsProduct[] {
  const limit = opts?.limit ?? 40;
  const emptyMeans = opts?.emptyMeans ?? "hs2";
  const q = query.trim().toLowerCase();
  if (!q) {
    if (emptyMeans === "none") return [];
    if (emptyMeans === "all") return ALL_HS_PRODUCTS.slice(0, limit);
    return HS2_PRODUCTS.slice(0, limit);
  }
  const out: HsProduct[] = [];
  for (const p of ALL_HS_PRODUCTS) {
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
  const exact = BY_CODE.get(code);
  if (exact) return `${exact.code}: ${exact.name[lang]}`;
  const digits = code.replace(/\D/g, "");
  if (digits.length >= 2) {
    const hit = BY_CODE.get(digits.slice(0, 2));
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

/**
 * Illustrative top importer ISO3 hints for search UX (not live aggregates).
 * Keyed by HS2 chapter until release ships trade roll-ups.
 */
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

/** Years available for project scope (BACI pin year_min..year_max). */
export const HS_TRADE_YEAR_MIN = 2012;
export const HS_TRADE_YEAR_MAX = 2024;

export function tradeYearOptions(): number[] {
  const years: number[] = [];
  for (let y = HS_TRADE_YEAR_MAX; y >= HS_TRADE_YEAR_MIN; y -= 1) years.push(y);
  return years;
}
