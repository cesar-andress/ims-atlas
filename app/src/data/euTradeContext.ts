/**
 * Structural EU / euro-area membership for Incoterms autofill.
 * Duty 0% inside the EU customs union; FX = 1 when both use EUR.
 * Not invented trade statistics — membership lists only.
 */

/** EU customs union members (ISO3) as of 2024 enlargement set. */
export const EU_CUSTOMS_ISO3 = new Set([
  "AUT",
  "BEL",
  "BGR",
  "HRV",
  "CYP",
  "CZE",
  "DNK",
  "EST",
  "FIN",
  "FRA",
  "DEU",
  "GRC",
  "HUN",
  "IRL",
  "ITA",
  "LVA",
  "LTU",
  "LUX",
  "MLT",
  "NLD",
  "POL",
  "PRT",
  "ROU",
  "SVK",
  "SVN",
  "ESP",
  "SWE",
]);

/** Euro-area members that use EUR as legal tender. */
export const EURO_AREA_ISO3 = new Set([
  "AUT",
  "BEL",
  "HRV",
  "CYP",
  "EST",
  "FIN",
  "FRA",
  "DEU",
  "GRC",
  "IRL",
  "ITA",
  "LVA",
  "LTU",
  "LUX",
  "MLT",
  "NLD",
  "PRT",
  "SVK",
  "SVN",
  "ESP",
]);

export function isEuCustomsMember(iso3: string | undefined): boolean {
  return !!iso3 && EU_CUSTOMS_ISO3.has(iso3.toUpperCase());
}

export function isEuroAreaMember(iso3: string | undefined): boolean {
  return !!iso3 && EURO_AREA_ISO3.has(iso3.toUpperCase());
}

export type DutyAutofill = {
  rate: number;
  sourceNote: string;
  sourceId: "eu_customs_union";
};

/** Intra-EU goods: 0% customs duty. Otherwise null (BYOD / WITS). */
export function intraEuDutyRate(
  origin: string | undefined,
  dest: string | undefined,
): DutyAutofill | null {
  if (!isEuCustomsMember(origin) || !isEuCustomsMember(dest)) return null;
  return {
    rate: 0,
    sourceNote:
      "Unión aduanera de la UE — libre circulación de mercancías (sin arancel entre Estados miembros)",
    sourceId: "eu_customs_union",
  };
}

export type FxAutofill = {
  rate: number;
  sourceNote: string;
  sourceId: "ecb_fx" | "euro_area";
};

/**
 * EUR→local for Incoterms display.
 * Both euro-area → 1 (EUR). Otherwise null until a live ECB feed is wired for the SPA.
 */
export function projectFxRate(
  origin: string | undefined,
  dest: string | undefined,
): FxAutofill | null {
  if (isEuroAreaMember(origin) && isEuroAreaMember(dest)) {
    return {
      rate: 1,
      sourceNote: "Zona euro — ambos usan EUR (tipo 1; BCE / eurofxref)",
      sourceId: "euro_area",
    };
  }
  if (isEuroAreaMember(dest)) {
    return {
      rate: 1,
      sourceNote: "Destino en zona euro (EUR = 1 frente al euro)",
      sourceId: "euro_area",
    };
  }
  return null;
}
