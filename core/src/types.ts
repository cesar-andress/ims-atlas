/** Shared engine types (SPEC §5). */

export type Direction = "benefit" | "cost";

export type NormalizationId =
  "minmax" | "ratio_legacy" | "zscore" | "robust_z" | "rank" | "log_minmax";

export type WeightSchemeId = "equal" | "manual" | "expert_mean" | "entropy" | "critic";

export type McdmId = "wsm" | "topsis" | "vikor" | "promethee_ii";

export type FactorId = string;

/** Catalog pre-normalisation transform (applied before minmax/z/…). */
export type CatalogTransformId = "none" | "log";

export type VariableSpec = {
  id: string;
  factor: FactorId;
  direction: Direction;
  /** From catalog `transform:` (e.g. log on IMPV/IMPC/GDPPC/DIST). */
  transform?: CatalogTransformId;
  /** From catalog `alias_of:` — do not co-weight with the canonical id. */
  aliasOf?: string;
};

export type HierarchicalWeights = {
  factors: Record<string, number>;
  variablesWithin: Record<string, Record<string, number>>;
  scheme: string;
  notes: string[];
};

export type PreparedBlock = {
  /** Row-major matrix: candidates × usedVariables (no NaN). */
  matrix: number[][];
  candidates: string[];
  usedVariables: string[];
  excludedVariables: string[];
  nCandidates: number;
  nImputedCells: number;
  /** Same shape as matrix; true where median imputation was applied. */
  imputedMask: boolean[][];
  notes: string[];
};

export type MissingDataPolicy = {
  maxMissingShare: number;
  minCandidates: number;
  /**
   * Residual-gap policy after the missing-share filter.
   * - median: fill gaps with the column median (default; never drops destinations)
   * - none: exclude any variable that still has a gap (no silent fill)
   */
  impute: "median" | "none";
};
