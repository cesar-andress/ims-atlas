/** HS2 chapter catalogue (names for search). HS4 can be typed manually. */

export type HsProduct = {
  code: string;
  name: { en: string; es: string };
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
  if (!q) return HS2_PRODUCTS;
  return HS2_PRODUCTS.filter(
    (p) =>
      p.code.includes(q) ||
      p.name.en.toLowerCase().includes(q) ||
      p.name.es.toLowerCase().includes(q) ||
      p.name[lang].toLowerCase().includes(q),
  );
}

export function hsLabel(code: string, lang: "en" | "es"): string {
  const hit = HS2_PRODUCTS.find((p) => p.code === code || code.startsWith(p.code));
  if (!hit) return code;
  return `${hit.code} — ${hit.name[lang]}`;
}

export function filterByRegion(iso3: string[], region: string | undefined): string[] {
  if (!region || region === "world") return iso3;
  const allow = new Set(REGION_ISO[region] ?? []);
  if (allow.size === 0) return iso3;
  return iso3.filter((c) => allow.has(c));
}
