/**
 * Published IMSFE / SMI method family presets (metadata + scale).
 * Paper table numbers for SMI 2018 must be transcribed by a human — not invented here.
 */

export type MethodFamilyId =
  "imsfe_2025" | "imsfem_2025_olive" | "smi_2018" | "smi_2020" | "panel_all";

export type MethodFamilySpec = {
  id: MethodFamilyId;
  labelEn: string;
  labelEs: string;
  /** Ratio scale upper bound (5 or 10). */
  scaleMax: number;
  nFactors: number;
  nVariables: number;
  defaultNormalization: "ratio_legacy";
  /** Optional link to Phase A2 criteria-tree preset id. */
  criteriaTreeId?: "imsfe_2025_footwear" | "imsfem_2025_olive";
  notes: string;
};

export const METHOD_FAMILIES: Record<MethodFamilyId, MethodFamilySpec> = {
  imsfe_2025: {
    id: "imsfe_2025",
    labelEn: "IMSFE 2025 footwear (6×3)",
    labelEs: "IMSFE 2025 calzado (6×3)",
    scaleMax: 10,
    nFactors: 6,
    nVariables: 18,
    defaultNormalization: "ratio_legacy",
    criteriaTreeId: "imsfe_2025_footwear",
    notes: "Workbook footwear method: expert means, DMP/IMP ratio 0–10, EOC matrix.",
  },
  imsfem_2025_olive: {
    id: "imsfem_2025_olive",
    labelEn: "IMSFEM 2025 olive oil (7×3, + Sustainability)",
    labelEs: "IMSFEM 2025 aceite (7×3, + Sostenibilidad)",
    scaleMax: 10,
    nFactors: 7,
    nVariables: 21,
    defaultNormalization: "ratio_legacy",
    criteriaTreeId: "imsfem_2025_olive",
    notes:
      "Olive-oil workbook: +SUST (CADE/GLCR/GLSI); LOGI uses RQBC; COMM uses ITBI. Aggregated respondent row.",
  },
  smi_2018: {
    id: "smi_2018",
    labelEn: "SMI 2018 classic (4×11, 0–5)",
    labelEs: "SMI 2018 clásico (4×11, 0–5)",
    scaleMax: 5,
    nFactors: 4,
    nVariables: 11,
    defaultNormalization: "ratio_legacy",
    notes: "Baena, Cano & Campo (2018) DyO 66. Golden needs human-transcribed Table 4.",
  },
  smi_2020: {
    id: "smi_2020",
    labelEn: "SMI 2020+ (5×23, AHP)",
    labelEs: "SMI 2020+ (5×23, AHP)",
    scaleMax: 10,
    nFactors: 5,
    nVariables: 23,
    defaultNormalization: "ratio_legacy",
    notes: "López-Cadavid et al. (2020) / Baena-Rojas et al. (2022). AHP weights.",
  },
  panel_all: {
    id: "panel_all",
    labelEn: "All panel variables (free)",
    labelEs: "Todas las variables del panel (libre)",
    scaleMax: 10,
    nFactors: 0,
    nVariables: 0,
    defaultNormalization: "ratio_legacy",
    notes:
      "No fixed criteria tree: use every available panel variable (or an explicit subset) with equal or manual weights.",
  },
};

/** Jose's 6×3 criterion → variable codes (workbook). */
export const IMSFE_2025_STRUCTURE: Record<string, string[]> = {
  COST: ["PPAD", "INTC", "CIBC"],
  LOGI: ["LPIN", "CPTR", "ITTT"],
  COMM: ["CUTA", "CCTI", "IOEF"],
  ECON: ["CLI", "INAN", "UNRA"],
  POLI: ["FSIN", "INRI", "DEIN"],
  CULT: ["GLIN", "CPIN", "CUDI"],
};

/** DMP = benefit (directly proportional); IMP = cost (inversely). */
export const IMSFE_2025_DIRECTION: Record<string, "benefit" | "cost"> = {
  PPAD: "benefit",
  INTC: "cost",
  CIBC: "cost",
  LPIN: "benefit",
  CPTR: "benefit",
  ITTT: "cost",
  CUTA: "cost",
  CCTI: "cost",
  IOEF: "benefit",
  CLI: "benefit",
  INAN: "cost",
  UNRA: "cost",
  FSIN: "cost",
  INRI: "cost",
  DEIN: "benefit",
  GLIN: "benefit",
  CPIN: "benefit",
  CUDI: "cost",
};

/** Open / BYOD mapping notes (candidates — licence to verify). */
export const IMSFE_2025_SOURCE_NOTES: Record<
  string,
  { openCandidate?: string; byod?: boolean; note: string }
> = {
  PPAD: { openCandidate: "UVGAP/BACI", note: "Unit values → BACI candidate" },
  INTC: { byod: true, note: "Freight calculators; licence UNKNOWN" },
  CIBC: {
    openCandidate: "IC.IMP.CSBC.CD",
    note: "Doing Business archived; flag archived series",
  },
  LPIN: { openCandidate: "LPI", note: "World Bank LPI" },
  CPTR: { openCandidate: "IS.SHP.GOOD.TU", note: "WDI container port traffic" },
  ITTT: { byod: true, note: "Sea distances / transit time; licence UNKNOWN" },
  CUTA: { openCandidate: "TARIF", note: "WITS / WTO; often BYOD" },
  CCTI: { byod: true, note: "Global Trade Alert; licence UNKNOWN" },
  IOEF: { byod: true, note: "Heritage Index of Economic Freedom; UNKNOWN" },
  CLI: { openCandidate: "PLI", note: "ICP price level candidate" },
  INAN: { openCandidate: "INFL", note: "WDI inflation" },
  UNRA: { openCandidate: "UNEMP", note: "WDI unemployment" },
  FSIN: { byod: true, note: "Fragile States Index; UNKNOWN" },
  INRI: { byod: true, note: "INFORM Risk; UNKNOWN" },
  DEIN: { byod: true, note: "EIU Democracy Index; UNKNOWN" },
  GLIN: { byod: true, note: "KOF Globalisation Index; UNKNOWN" },
  CPIN: { byod: true, note: "Transparency CPI; UNKNOWN" },
  CUDI: { openCandidate: "CULT", note: "Hofstede BYOD cultural distance" },
};
