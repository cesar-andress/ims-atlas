/** HS2/HS4 catalogue for search + category tree (names for UI; codes are HS). */

export type HsProduct = {
  code: string;
  name: { en: string; es: string };
  /** Parent HS2 when this is an HS4 leaf. */
  parent?: string;
};

/** Common HS2 chapters used in IMS demos; full list is searchable by code. */
export const HS2_PRODUCTS: HsProduct[] = [
  { code: "01", name: { en: "Live animals", es: "Animales vivos" } },
  { code: "02", name: { en: "Meat", es: "Carne" } },
  { code: "03", name: { en: "Fish", es: "Pescado" } },
  { code: "04", name: { en: "Dairy", es: "Lácteos" } },
  { code: "07", name: { en: "Vegetables", es: "Hortalizas" } },
  { code: "08", name: { en: "Fruit & nuts", es: "Frutas y frutos secos" } },
  { code: "09", name: { en: "Coffee, tea, spices", es: "Café, té, especias" } },
  { code: "15", name: { en: "Fats & oils", es: "Grasas y aceites" } },
  { code: "17", name: { en: "Sugars", es: "Azúcares" } },
  { code: "18", name: { en: "Cocoa", es: "Cacao" } },
  { code: "22", name: { en: "Beverages", es: "Bebidas" } },
  { code: "27", name: { en: "Mineral fuels", es: "Combustibles minerales" } },
  { code: "30", name: { en: "Pharmaceuticals", es: "Productos farmacéuticos" } },
  { code: "39", name: { en: "Plastics", es: "Plásticos" } },
  { code: "40", name: { en: "Rubber", es: "Caucho" } },
  { code: "48", name: { en: "Paper", es: "Papel" } },
  { code: "61", name: { en: "Apparel, knitted", es: "Prendas de punto" } },
  { code: "62", name: { en: "Apparel, not knitted", es: "Prendas no de punto" } },
  {
    code: "64",
    name: { en: "Footwear", es: "Calzado" },
  },
  { code: "71", name: { en: "Precious metals/stones", es: "Metales/piedras preciosas" } },
  { code: "72", name: { en: "Iron & steel", es: "Hierro y acero" } },
  { code: "84", name: { en: "Machinery", es: "Máquinas" } },
  { code: "85", name: { en: "Electrical machinery", es: "Maquinaria eléctrica" } },
  { code: "87", name: { en: "Vehicles", es: "Vehículos" } },
  { code: "90", name: { en: "Optical / medical", es: "Óptica / médicos" } },
];

/** Illustrative HS4 leaves under common chapters (for category tree / name search). */
export const HS4_PRODUCTS: HsProduct[] = [
  { code: "6401", parent: "64", name: { en: "Waterproof footwear", es: "Calzado impermeable" } },
  { code: "6402", parent: "64", name: { en: "Other footwear, rubber/plastics", es: "Otro calzado caucho/plástico" } },
  { code: "6403", parent: "64", name: { en: "Footwear with leather uppers", es: "Calzado con corte de cuero" } },
  { code: "6404", parent: "64", name: { en: "Footwear with textile uppers", es: "Calzado con corte textil" } },
  { code: "6405", parent: "64", name: { en: "Other footwear", es: "Otro calzado" } },
  { code: "6406", parent: "64", name: { en: "Parts of footwear", es: "Partes de calzado" } },
  { code: "8471", parent: "84", name: { en: "Automatic data processing machines", es: "Máquinas de procesamiento de datos" } },
  { code: "8481", parent: "84", name: { en: "Taps, cocks, valves", es: "Grifos, válvulas" } },
  { code: "8501", parent: "85", name: { en: "Electric motors and generators", es: "Motores y generadores eléctricos" } },
  { code: "8517", parent: "85", name: { en: "Telephone sets / networks", es: "Teléfonos / redes" } },
  { code: "8701", parent: "87", name: { en: "Tractors", es: "Tractores" } },
  { code: "8702", parent: "87", name: { en: "Buses and coaches", es: "Autobuses" } },
  { code: "8703", parent: "87", name: { en: "Motor cars", es: "Automóviles" } },
  { code: "8704", parent: "87", name: { en: "Goods vehicles", es: "Vehículos de carga" } },
  { code: "8708", parent: "87", name: { en: "Parts for motor vehicles", es: "Partes de vehículos" } },
  { code: "8414", parent: "84", name: { en: "Air / vacuum pumps", es: "Bombas de aire / vacío" } },
  { code: "8421", parent: "84", name: { en: "Centrifuges, filters", es: "Centrifugadoras, filtros" } },
  { code: "8431", parent: "84", name: { en: "Parts for lifting machinery", es: "Partes para maquinaria de elevación" } },
  { code: "1507", parent: "15", name: { en: "Soya-bean oil", es: "Aceite de soja" } },
  { code: "1509", parent: "15", name: { en: "Olive oil", es: "Aceite de oliva" } },
  { code: "1512", parent: "15", name: { en: "Sunflower / safflower oil", es: "Aceite de girasol / cártamo" } },
  { code: "3004", parent: "30", name: { en: "Medicaments in measured doses", es: "Medicamentos en dosis" } },
  { code: "2204", parent: "22", name: { en: "Wine of fresh grapes", es: "Vino de uvas frescas" } },
];

/** Illustrative HS6 leaves (parent = HS4). */
export const HS6_PRODUCTS: HsProduct[] = [
  {
    code: "640399",
    parent: "6403",
    name: {
      en: "Other footwear with leather uppers",
      es: "Otro calzado con corte de cuero",
    },
  },
  {
    code: "640411",
    parent: "6404",
    name: {
      en: "Sports footwear with textile uppers",
      es: "Calzado deportivo con corte textil",
    },
  },
  {
    code: "150910",
    parent: "1509",
    name: {
      en: "Virgin olive oil",
      es: "Aceite de oliva virgen",
    },
  },
  {
    code: "150990",
    parent: "1509",
    name: {
      en: "Other olive oil",
      es: "Otros aceites de oliva",
    },
  },
];

export const ALL_HS_PRODUCTS: HsProduct[] = [
  ...HS2_PRODUCTS,
  ...HS4_PRODUCTS,
  ...HS6_PRODUCTS,
];

export type HsTreeNode = HsProduct & { children: HsProduct[] };

/** HS2 → HS4 tree; HS6 codes are available via search. */
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

export function searchHs(query: string, lang: "en" | "es"): HsProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_HS_PRODUCTS;
  return ALL_HS_PRODUCTS.filter(
    (p) =>
      p.code.includes(q) ||
      p.name.en.toLowerCase().includes(q) ||
      p.name.es.toLowerCase().includes(q) ||
      p.name[lang].toLowerCase().includes(q),
  );
}

export function hsLabel(code: string, lang: "en" | "es"): string {
  const exact = ALL_HS_PRODUCTS.find((p) => p.code === code);
  if (exact) return `${exact.code}: ${exact.name[lang]}`;
  const hit = HS2_PRODUCTS.find((p) => code.startsWith(p.code));
  if (!hit) return code;
  return `${code} (${hit.name[lang]})`;
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
