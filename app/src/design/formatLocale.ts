/** Locale-aware number formatting (ES uses comma decimals). */

export function formatScoreLocale(
  value: number,
  lang: "en" | "es",
  digits = 2,
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPctLocale(value: number, lang: "en" | "es", digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-US", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Country display name via Intl (CLDR); falls back to ISO3. */
export function countryLabel(iso3: string, lang: "en" | "es"): string {
  try {
    const dn = new Intl.DisplayNames([lang === "es" ? "es" : "en"], {
      type: "region",
    });
    // DisplayNames expects ISO 3166-1 alpha-2; map common alpha-3 via a tiny bridge.
    const a2 = ISO3_TO_A2[iso3];
    if (a2) {
      const name = dn.of(a2);
      if (name) return name;
    }
  } catch {
    /* ignore */
  }
  return iso3;
}

/** Subset used in demos; extend only with verified ISO mappings. */
const ISO3_TO_A2: Record<string, string> = {
  COL: "CO",
  USA: "US",
  CHN: "CN",
  DEU: "DE",
  FRA: "FR",
  GBR: "GB",
  ITA: "IT",
  ESP: "ES",
  NLD: "NL",
  BEL: "BE",
  CHE: "CH",
  AUT: "AT",
  SWE: "SE",
  NOR: "NO",
  DNK: "DK",
  FIN: "FI",
  POL: "PL",
  CZE: "CZ",
  SVK: "SK",
  HUN: "HU",
  PRT: "PT",
  GRC: "GR",
  IRL: "IE",
  LUX: "LU",
  CAN: "CA",
  MEX: "MX",
  BRA: "BR",
  ARG: "AR",
  CHL: "CL",
  PER: "PE",
  JPN: "JP",
  KOR: "KR",
  AUS: "AU",
  NZL: "NZ",
  SGP: "SG",
  HKG: "HK",
  ARE: "AE",
  SAU: "SA",
  ZAF: "ZA",
  IND: "IN",
  IDN: "ID",
  THA: "TH",
  VNM: "VN",
  MYS: "MY",
  TUR: "TR",
  RUS: "RU",
  UKR: "UA",
  ROU: "RO",
  BGR: "BG",
  HRV: "HR",
  SVN: "SI",
  LTU: "LT",
  LVA: "LV",
  EST: "EE",
  ISL: "IS",
  ISR: "IL",
  EGY: "EG",
  MAR: "MA",
  NGA: "NG",
  KEN: "KE",
  ECU: "EC",
  URY: "UY",
  PRY: "PY",
  BOL: "BO",
  CRI: "CR",
  PAN: "PA",
  GTM: "GT",
  HND: "HN",
  SLV: "SV",
  NIC: "NI",
  DOM: "DO",
  JAM: "JM",
  TTO: "TT",
  PHL: "PH",
  PAK: "PK",
  BGD: "BD",
  LKA: "LK",
  QAT: "QA",
  KWT: "KW",
  BHR: "BH",
  OMN: "OM",
  JOR: "JO",
  LBN: "LB",
  TUN: "TN",
  DZA: "DZ",
  GHA: "GH",
  ETH: "ET",
  TZA: "TZ",
  UGA: "UG",
  SEN: "SN",
  CIV: "CI",
  CMR: "CM",
  AGO: "AO",
  MOZ: "MZ",
  ZMB: "ZM",
  ZWE: "ZW",
  BWA: "BW",
  NAM: "NA",
  MUS: "MU",
  MDG: "MG",
  KAZ: "KZ",
  UZB: "UZ",
  AZE: "AZ",
  GEO: "GE",
  ARM: "AM",
  BLR: "BY",
  MDA: "MD",
  SRB: "RS",
  BIH: "BA",
  MKD: "MK",
  ALB: "AL",
  MNE: "ME",
  XKX: "XK",
  CYP: "CY",
  MLT: "MT",
  TWN: "TW",
  MAC: "MO",
  MNG: "MN",
  NPL: "NP",
  MMR: "MM",
  KHM: "KH",
  LAO: "LA",
  BRN: "BN",
  FJI: "FJ",
  PNG: "PG",
  CUB: "CU",
  HTI: "HT",
  SUR: "SR",
  GUY: "GY",
  BLZ: "BZ",
  BRB: "BB",
  BHS: "BS",
  ISL2: "IS",
};
