/**
 * IMSFE 2025 15-expert means (from ims-backtest v0.2.0 ``config/weights_expert.yaml``).
 * Factor bridge matches ``imsfe.weights.LEGACY_FACTOR_MAP``.
 */

export const LEGACY_FACTOR_MAP: Record<string, string> = {
  cost_access: "COST",
  logistics: "LOGI",
  competition: "COMM",
  macro_risk: "ECON",
  institutional: "POLI",
  product_fit: "CULT",
};

/** Legacy factor means. */
export const EXPERT_FACTOR_MEANS: Record<string, number> = {
  COST: 0.21466666666666667,
  LOGI: 0.18466666666666667,
  COMM: 0.19333333333333333,
  ECON: 0.15333333333333332,
  POLI: 0.13066666666666665,
  CULT: 0.12333333333333332,
};

/** Legacy variable means keyed by legacy spreadsheet id. */
export const EXPERT_VARIABLE_MEANS: Record<string, number> = {
  PPAD: 0.43,
  INTC: 0.35,
  CIBC: 0.22000000000000006,
  LPIN: 0.4,
  CPTR: 0.26333333333333336,
  ITTT: 0.33666666666666667,
  CUTA: 0.49,
  CCTI: 0.2533333333333333,
  IOEF: 0.25666666666666665,
  CLI: 0.34,
  INAN: 0.3466666666666667,
  UNRA: 0.3133333333333333,
  FSIN: 0.3433333333333334,
  INRI: 0.37333333333333324,
  DEIN: 0.2833333333333333,
  GLIN: 0.29333333333333333,
  CPIN: 0.32,
  CUDI: 0.3866666666666667,
};
