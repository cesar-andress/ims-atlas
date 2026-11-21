/**
 * Canonical BYOD upload template (CSV).
 * Columns must match parseByodCsv in byodStore.ts — do not invent fields.
 */

export const BYOD_TEMPLATE_FILENAME = "plantilla-datos-propios.csv";

/**
 * Mock sample rows: country-level (empty iso3_d) and bilateral (iso3_d set).
 * Header names are the exact conventions the importer looks up (case-insensitive).
 */
export const BYOD_TEMPLATE_CSV = [
  "iso3,year,value,iso3_d",
  "COL,2022,72.5,",
  "ESP,2022,81.0,",
  "MEX,2022,65.2,",
  "COL,2022,1.25,USA",
  "COL,2022,0.90,DEU",
  "ESP,2022,2.10,FRA",
].join("\n");

export type ByodTemplateField = {
  /** Exact CSV header the importer expects (lowercase). */
  name: "iso3" | "year" | "value" | "iso3_d";
  required: boolean;
  /** Plain-language Spanish name / role. */
  labelEs: string;
  labelEn: string;
};

/** Column conventions documented for the UI legend (importer contract). */
export const BYOD_TEMPLATE_FIELDS: readonly ByodTemplateField[] = [
  {
    name: "iso3",
    required: true,
    labelEs: "Código de país ISO-3166-1 alpha-3 (origen o unidad; p. ej. COL, ESP)",
    labelEn: "ISO-3166-1 alpha-3 country code (origin or unit; e.g. COL, ESP)",
  },
  {
    name: "year",
    required: true,
    labelEs: "Año civil entero (1900–2100)",
    labelEn: "Integer calendar year (1900–2100)",
  },
  {
    name: "value",
    required: true,
    labelEs: "Valor numérico de la variable en esa fila",
    labelEn: "Numeric value of the variable for that row",
  },
  {
    name: "iso3_d",
    required: false,
    labelEs:
      "Destino bilateral (opcional). Vacío = dato de país; con código = par origen-destino",
    labelEn:
      "Bilateral destination (optional). Empty = country-level; set = origin-destination pair",
  },
] as const;

/** Variable id is chosen in the upload form, not inside the CSV. */
export const BYOD_VARIABLE_ID_HINT_ES =
  "El nombre de la variable (identificador, p. ej. MYVAR o TARIF) se elige en el formulario al subir; solo letras, números y _. No va en el CSV.";

export const BYOD_VARIABLE_ID_HINT_EN =
  "The variable name (id, e.g. MYVAR or TARIF) is chosen in the upload form; letters, digits and _ only. It is not a CSV column.";

export function byodTemplateBlob(): Blob {
  return new Blob([`${BYOD_TEMPLATE_CSV}\n`], {
    type: "text/csv;charset=utf-8",
  });
}

/** Public URL path under Vite BASE_URL (leading slash omitted for join). */
export function byodTemplatePublicPath(baseUrl: string = "/"): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${BYOD_TEMPLATE_FILENAME}`;
}
