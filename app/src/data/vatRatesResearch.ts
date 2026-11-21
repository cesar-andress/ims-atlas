/**
 * Statutory standard VAT rates for Incoterms autofill only.
 * Rows mirror `data/static/vat_rates.csv` (cited national authorities).
 * Not a ranking-panel variable (no catalog variable_id; used for Incoterms/VAT).
 * Skip placeholder rows (no federal / multi-tax systems).
 */

export type VatRateHit = {
  iso3: string;
  year: number;
  /** Rate 0–1 (e.g. 0.19 for 19%). */
  rate: number;
  sourceNote: string;
  sourceId: "vat_rates";
};

const ROWS: readonly {
  iso3: string;
  year: number;
  pct: number;
  note: string;
  placeholder?: boolean;
}[] = [
  {
    iso3: "DEU",
    year: 2025,
    pct: 19,
    note: "Bundesministerium der Finanzen — standard VAT 19%",
  },
  {
    iso3: "FRA",
    year: 2025,
    pct: 20,
    note: "Service-Public.fr — TVA normale 20%",
  },
  {
    iso3: "ESP",
    year: 2025,
    pct: 21,
    note: "Agencia Tributaria — IVA general 21%",
  },
  {
    iso3: "ITA",
    year: 2025,
    pct: 22,
    note: "Agenzia delle Entrate — IVA ordinaria 22%",
  },
  {
    iso3: "NLD",
    year: 2025,
    pct: 21,
    note: "Belastingdienst — algemeen tarief 21%",
  },
  {
    iso3: "BEL",
    year: 2025,
    pct: 21,
    note: "FPS Finance — standard VAT 21%",
  },
  {
    iso3: "PRT",
    year: 2025,
    pct: 23,
    note: "Autoridade Tributária — taxa normal 23%",
  },
  {
    iso3: "IRL",
    year: 2025,
    pct: 23,
    note: "Revenue Irish Tax — standard VAT 23%",
  },
  {
    iso3: "AUT",
    year: 2025,
    pct: 20,
    note: "BMF Austria — Normalsteuersatz 20%",
  },
  {
    iso3: "CHE",
    year: 2025,
    pct: 8.1,
    note: "ESTV — MWST Normalsatz 8.1%",
  },
  {
    iso3: "GBR",
    year: 2025,
    pct: 20,
    note: "GOV.UK — standard VAT 20%",
  },
  {
    iso3: "USA",
    year: 2025,
    pct: 0,
    note: "No federal VAT; state sales tax varies (placeholder 0)",
    placeholder: true,
  },
  {
    iso3: "COL",
    year: 2025,
    pct: 19,
    note: "DIAN — IVA general 19%",
  },
  {
    iso3: "MEX",
    year: 2025,
    pct: 16,
    note: "SAT — IVA 16%",
  },
  {
    iso3: "BRA",
    year: 2025,
    pct: 0,
    note: "No single federal VAT rate (ICMS/ISS); placeholder 0",
    placeholder: true,
  },
  {
    iso3: "CHN",
    year: 2025,
    pct: 13,
    note: "State Taxation Administration — standard VAT 13%",
  },
  {
    iso3: "JPN",
    year: 2025,
    pct: 10,
    note: "National Tax Agency — consumption tax 10%",
  },
  {
    iso3: "KOR",
    year: 2025,
    pct: 10,
    note: "NTS Korea — VAT 10%",
  },
  {
    iso3: "IND",
    year: 2025,
    pct: 18,
    note: "GST Council — typical standard slab 18% (simplified)",
  },
  {
    iso3: "AUS",
    year: 2025,
    pct: 10,
    note: "ATO — GST 10%",
  },
  {
    iso3: "CAN",
    year: 2025,
    pct: 5,
    note: "CRA — GST 5% (provincial extras not included)",
  },
];

/** Lookup standard VAT for ISO3; null when unknown or placeholder. */
export function vatRateForIso3(iso3: string | undefined): VatRateHit | null {
  if (!iso3 || !/^[A-Za-z]{3}$/.test(iso3)) return null;
  const key = iso3.toUpperCase();
  const row = ROWS.find((r) => r.iso3 === key);
  if (!row || row.placeholder) return null;
  return {
    iso3: key,
    year: row.year,
    rate: row.pct / 100,
    sourceNote: row.note,
    sourceId: "vat_rates",
  };
}
