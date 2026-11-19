/**
 * Permalink / project config schema without Zod (keeps Home JS lean).
 */

const VIEWS = [
  "home",
  "datos",
  "variables",
  "analisis",
  "design",
  "catalog",
  "builder",
  "ranking",
  "matrix",
  "map",
  "uncertainty",
  "backtest",
  "time",
  "cite",
  "byod",
  "imsfe_import",
  "ai_verify",
  "docs",
  "paper",
  "changelog",
  "data_sources",
  "data_variable",
  "data_pipeline",
  "data_releases",
  "data_updates",
  "status",
  "factors",
  "compare",
  "norm_lab",
  "projects",
  "project_variables",
  "project_coverage",
  "project_dashboard",
  "explore",
  "explore_analysis",
  "country",
  "sql",
] as const;

export type ViewId = (typeof VIEWS)[number];

const VIEW_SET = new Set<string>(VIEWS);

const NORMALIZATIONS = [
  "minmax",
  "ratio_legacy",
  "zscore",
  "robust_z",
  "rank",
  "log_minmax",
] as const;

const LAB_SKEWS = ["none", "log", "log1p"] as const;
const LAB_OUTLIERS = ["none", "winsor_1_99", "winsor_5_95"] as const;
const LAB_SCALES = ["ratio", "minmax", "zscore", "robust_z", "rank"] as const;
const LAB_REFS = ["candidates", "all_countries", "base_year"] as const;
const LAB_POOLING = ["per_year", "pooled"] as const;
export type NormalizationId = (typeof NORMALIZATIONS)[number];

const MCDM = ["wsm", "topsis", "vikor", "promethee_ii"] as const;
export type McdmId = (typeof MCDM)[number];

const WEIGHT_SCHEMES = ["equal", "manual", "expert_mean", "entropy", "critic"] as const;
export type WeightSchemeId = (typeof WEIGHT_SCHEMES)[number];

export type AnalysisConfig = {
  v: 1;
  view: ViewId;
  origin?: string | undefined;
  year?: number | undefined;
  hs?: string | undefined;
  region?: string | undefined;
  minImports?: number | undefined;
  normalization?: NormalizationId | undefined;
  mcdm?: McdmId | undefined;
  weightScheme?: WeightSchemeId | undefined;
  missingThreshold?: number | undefined;
  variableIds?: string[] | undefined;
  factorWeights?: Record<string, number> | undefined;
  /** Phase Z lab: skew / outlier / dual scale / reference. */
  labSkew?: (typeof LAB_SKEWS)[number] | undefined;
  labOutlier?: (typeof LAB_OUTLIERS)[number] | undefined;
  labScale?: (typeof LAB_SCALES)[number] | undefined;
  labCompareScale?: (typeof LAB_SCALES)[number] | undefined;
  labReferenceSet?: (typeof LAB_REFS)[number] | undefined;
  labYearPooling?: (typeof LAB_POOLING)[number] | undefined;
  labDecorrelate?: boolean | undefined;
  compareA?: string | undefined;
  compareB?: string | undefined;
  matrixCutoff?: "median" | "fixed" | undefined;
  matrixCutA?: number | undefined;
  matrixCutF?: number | undefined;
  /** attractiveness×fit (legacy) or IMSFE×EOC (Baena & Cano). */
  matrixMode?: "attractiveness_fit" | "imsfe_eoc" | undefined;
  /** IMSFE / SMI method family preset. */
  methodFamily?:
    "imsfe_2025" | "imsfem_2025_olive" | "smi_2018" | "smi_2020" | undefined;
  /** Display criteria/variables ordered by weight (Orden definitivo); scores unchanged. */
  orderByWeight?: boolean | undefined;
  /** Phase A3: cost zero policy for IMP variables. */
  zeroPolicy?: "epsilon" | "minmax" | "rank" | "offset_ratio" | undefined;
  zeroEpsilon?: number | undefined;
  zeroOffsetC?: number | undefined;
  /** Phase A3: cultural distance definition. */
  culturalDistanceKind?: "sum_of_sums" | "sum_abs_diff" | "kogut_singh" | undefined;
  preselectMode?: "top_n" | "cumulative_share" | undefined;
  preselectTopN?: number | undefined;
  preselectCumShare?: number | undefined;
  clusterK?: number | undefined;
  mapSeed?: number | undefined;
  mapColor?: "cluster" | "quadrant" | undefined;
  /** VOSviewer-style mode (SPEC §12). */
  mapMode?: "network" | "overlay" | "density" | undefined;
  /** Variable id for overlay colouring. */
  mapOverlayVar?: string | undefined;
  backtestTarget?: "intensive" | "new_markets" | "growth" | undefined;
  backtestHorizon?: 1 | 3 | undefined;
  lang?: "en" | "es" | undefined;
  /** Variable id for /data/variables/:id transparency detail. */
  focusVariable?: string | undefined;
  /** Phase E country profile ISO3. */
  focusCountry?: string | undefined;
  /** Phase E explore filters (URL). */
  exploreFactor?: string | undefined;
  exploreSource?: string | undefined;
  exploreLicence?: "all" | "open" | "closed" | undefined;
  exploreYearFrom?: number | undefined;
  exploreYearTo?: number | undefined;
  exploreMinCoverage?: number | undefined;
  explorePinned?: string[] | undefined;
  scatterX?: string | undefined;
  scatterY?: string | undefined;
  /** Expert SQL console unlock. */
  expertMode?: boolean | undefined;
};

export type ProjectFile = {
  kind: "ims-atlas-project";
  savedAt: string;
  config: AnalysisConfig;
  label?: string | undefined;
};

export const DEFAULT_CONFIG: AnalysisConfig = {
  v: 1,
  view: "home",
};

export const COL_HS64_PRESET: AnalysisConfig = {
  v: 1,
  view: "ranking",
  origin: "COL",
  year: 2023,
  hs: "64",
  region: "world",
  normalization: "minmax",
  mcdm: "wsm",
  weightScheme: "expert_mean",
  missingThreshold: 0.2,
  lang: "en",
};

/** IMSFE (Baena & Cano) faithful preset — ratio 0–10, expert means, EOC matrix. */
export const IMSFE_BAENA_CANO_PRESET: AnalysisConfig = {
  v: 1,
  view: "ranking",
  origin: "COL",
  year: 2023,
  hs: "64",
  region: "world",
  normalization: "ratio_legacy",
  mcdm: "wsm",
  weightScheme: "expert_mean",
  missingThreshold: 0.2,
  methodFamily: "imsfe_2025",
  matrixMode: "imsfe_eoc",
  matrixCutoff: "median",
  preselectMode: "top_n",
  preselectTopN: 30,
  lang: "es",
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

function asIso3(v: unknown): string | undefined {
  return typeof v === "string" && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : undefined;
}

function asFiniteNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asIntInRange(v: unknown, lo: number, hi: number): number | undefined {
  const n = asFiniteNumber(v);
  if (n === undefined || !Number.isInteger(n) || n < lo || n > hi) return undefined;
  return n;
}

function parseViewId(v: unknown, fallback: ViewId = "home"): ViewId {
  return typeof v === "string" && VIEW_SET.has(v) ? (v as ViewId) : fallback;
}

/** Lightweight drop-in for the former Zod ViewIdSchema. */
export const ViewIdSchema = {
  safeParse(v: unknown): { success: true; data: ViewId } | { success: false } {
    if (typeof v === "string" && VIEW_SET.has(v)) {
      return { success: true, data: v as ViewId };
    }
    return { success: false };
  },
};

export function parseAnalysisConfig(input: unknown): AnalysisConfig {
  if (!isObject(input)) throw new Error("config must be an object");
  if (input.v !== 1) throw new Error("unsupported config version");

  const out: AnalysisConfig = {
    v: 1,
    view: parseViewId(input.view, "home"),
  };

  const origin = asIso3(input.origin);
  if (origin) out.origin = origin;

  const year = asIntInRange(input.year, 1900, 2100);
  if (year !== undefined) out.year = year;

  if (typeof input.hs === "string" && input.hs.length >= 2 && input.hs.length <= 6) {
    out.hs = input.hs;
  }
  if (
    typeof input.region === "string" &&
    input.region.length >= 1 &&
    input.region.length <= 32
  ) {
    out.region = input.region;
  }

  const minImports = asFiniteNumber(input.minImports);
  if (minImports !== undefined && minImports >= 0) out.minImports = minImports;

  const normalization = asEnum(input.normalization, NORMALIZATIONS);
  if (normalization) out.normalization = normalization;

  const labSkew = asEnum(input.labSkew, LAB_SKEWS);
  if (labSkew) out.labSkew = labSkew;
  const labOutlier = asEnum(input.labOutlier, LAB_OUTLIERS);
  if (labOutlier) out.labOutlier = labOutlier;
  const labScale = asEnum(input.labScale, LAB_SCALES);
  if (labScale) out.labScale = labScale;
  const labCompareScale = asEnum(input.labCompareScale, LAB_SCALES);
  if (labCompareScale) out.labCompareScale = labCompareScale;
  const labReferenceSet = asEnum(input.labReferenceSet, LAB_REFS);
  if (labReferenceSet) out.labReferenceSet = labReferenceSet;
  const labYearPooling = asEnum(input.labYearPooling, LAB_POOLING);
  if (labYearPooling) out.labYearPooling = labYearPooling;
  if (typeof input.labDecorrelate === "boolean") {
    out.labDecorrelate = input.labDecorrelate;
  }

  const mcdm = asEnum(input.mcdm, MCDM);
  if (mcdm) out.mcdm = mcdm;

  const weightScheme = asEnum(input.weightScheme, WEIGHT_SCHEMES);
  if (weightScheme) out.weightScheme = weightScheme;

  const missingThreshold = asFiniteNumber(input.missingThreshold);
  if (
    missingThreshold !== undefined &&
    missingThreshold >= 0 &&
    missingThreshold <= 1
  ) {
    out.missingThreshold = missingThreshold;
  }

  if (Array.isArray(input.variableIds)) {
    const ids = input.variableIds
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .slice(0, 64);
    if (ids.length) out.variableIds = ids;
  }

  if (isObject(input.factorWeights)) {
    const fw: Record<string, number> = {};
    for (const [k, val] of Object.entries(input.factorWeights)) {
      const n = asFiniteNumber(val);
      if (n !== undefined) fw[k] = n;
    }
    if (Object.keys(fw).length) out.factorWeights = fw;
  }

  const compareA = asIso3(input.compareA);
  if (compareA) out.compareA = compareA;
  const compareB = asIso3(input.compareB);
  if (compareB) out.compareB = compareB;

  const matrixCutoff = asEnum(input.matrixCutoff, ["median", "fixed"] as const);
  if (matrixCutoff) out.matrixCutoff = matrixCutoff;

  const matrixCutA = asFiniteNumber(input.matrixCutA);
  if (matrixCutA !== undefined) out.matrixCutA = matrixCutA;
  const matrixCutF = asFiniteNumber(input.matrixCutF);
  if (matrixCutF !== undefined) out.matrixCutF = matrixCutF;

  const matrixMode = asEnum(input.matrixMode, [
    "attractiveness_fit",
    "imsfe_eoc",
  ] as const);
  if (matrixMode) out.matrixMode = matrixMode;

  const methodFamily = asEnum(input.methodFamily, [
    "imsfe_2025",
    "imsfem_2025_olive",
    "smi_2018",
    "smi_2020",
  ] as const);
  if (methodFamily) out.methodFamily = methodFamily;

  if (typeof input.orderByWeight === "boolean") {
    out.orderByWeight = input.orderByWeight;
  }

  const zeroPolicy = asEnum(input.zeroPolicy, [
    "epsilon",
    "minmax",
    "rank",
    "offset_ratio",
  ] as const);
  if (zeroPolicy) out.zeroPolicy = zeroPolicy;
  const zeroEpsilon = asFiniteNumber(input.zeroEpsilon);
  if (zeroEpsilon !== undefined && zeroEpsilon > 0) out.zeroEpsilon = zeroEpsilon;
  const zeroOffsetC = asFiniteNumber(input.zeroOffsetC);
  if (zeroOffsetC !== undefined && zeroOffsetC >= 0) {
    out.zeroOffsetC = zeroOffsetC;
  }
  const culturalDistanceKind = asEnum(input.culturalDistanceKind, [
    "sum_of_sums",
    "sum_abs_diff",
    "kogut_singh",
  ] as const);
  if (culturalDistanceKind) out.culturalDistanceKind = culturalDistanceKind;

  const preselectMode = asEnum(input.preselectMode, [
    "top_n",
    "cumulative_share",
  ] as const);
  if (preselectMode) out.preselectMode = preselectMode;

  const preselectTopN = asIntInRange(input.preselectTopN, 1, 250);
  if (preselectTopN !== undefined) out.preselectTopN = preselectTopN;

  const preselectCumShare = asFiniteNumber(input.preselectCumShare);
  if (
    preselectCumShare !== undefined &&
    preselectCumShare > 0 &&
    preselectCumShare <= 1
  ) {
    out.preselectCumShare = preselectCumShare;
  }

  const clusterK = asIntInRange(input.clusterK, 2, 12);
  if (clusterK !== undefined) out.clusterK = clusterK;

  const mapSeed = asIntInRange(
    input.mapSeed,
    Number.MIN_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
  );
  if (mapSeed !== undefined) out.mapSeed = mapSeed;

  const mapColor = asEnum(input.mapColor, ["cluster", "quadrant"] as const);
  if (mapColor) out.mapColor = mapColor;

  const mapMode = asEnum(input.mapMode, ["network", "overlay", "density"] as const);
  if (mapMode) out.mapMode = mapMode;

  if (typeof input.mapOverlayVar === "string" && input.mapOverlayVar.trim()) {
    out.mapOverlayVar = input.mapOverlayVar.trim().slice(0, 32);
  }

  const backtestTarget = asEnum(input.backtestTarget, [
    "intensive",
    "new_markets",
    "growth",
  ] as const);
  if (backtestTarget) out.backtestTarget = backtestTarget;

  const backtestHorizon = asFiniteNumber(input.backtestHorizon);
  if (backtestHorizon === 1 || backtestHorizon === 3) {
    out.backtestHorizon = backtestHorizon;
  }

  const lang = asEnum(input.lang, ["en", "es"] as const);
  if (lang) out.lang = lang;

  if (
    typeof input.focusVariable === "string" &&
    /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(input.focusVariable)
  ) {
    out.focusVariable = input.focusVariable;
  }

  const focusCountry = asIso3(input.focusCountry);
  if (focusCountry) out.focusCountry = focusCountry;

  if (typeof input.exploreFactor === "string" && input.exploreFactor.trim()) {
    out.exploreFactor = input.exploreFactor.trim().slice(0, 64);
  }
  if (typeof input.exploreSource === "string" && input.exploreSource.trim()) {
    out.exploreSource = input.exploreSource.trim().slice(0, 64);
  }
  const exploreLicence = asEnum(input.exploreLicence, [
    "all",
    "open",
    "closed",
  ] as const);
  if (exploreLicence) out.exploreLicence = exploreLicence;

  const exploreYearFrom = asIntInRange(input.exploreYearFrom, 1900, 2100);
  if (exploreYearFrom !== undefined) out.exploreYearFrom = exploreYearFrom;
  const exploreYearTo = asIntInRange(input.exploreYearTo, 1900, 2100);
  if (exploreYearTo !== undefined) out.exploreYearTo = exploreYearTo;

  const exploreMinCoverage = asFiniteNumber(input.exploreMinCoverage);
  if (
    exploreMinCoverage !== undefined &&
    exploreMinCoverage >= 0 &&
    exploreMinCoverage <= 1
  ) {
    out.exploreMinCoverage = exploreMinCoverage;
  }

  if (Array.isArray(input.explorePinned)) {
    const pinned = input.explorePinned
      .filter((x): x is string => typeof x === "string" && /^[A-Za-z]{3}$/.test(x))
      .map((x) => x.toUpperCase())
      .slice(0, 24);
    if (pinned.length) out.explorePinned = pinned;
  }

  if (typeof input.scatterX === "string" && input.scatterX.trim()) {
    out.scatterX = input.scatterX.trim().slice(0, 32);
  }
  if (typeof input.scatterY === "string" && input.scatterY.trim()) {
    out.scatterY = input.scatterY.trim().slice(0, 32);
  }
  if (typeof input.expertMode === "boolean") out.expertMode = input.expertMode;

  return out;
}

export const AnalysisConfigSchema = {
  parse(input: unknown): AnalysisConfig {
    return parseAnalysisConfig(input);
  },
};

export function parseProjectFile(input: unknown): ProjectFile {
  if (!isObject(input)) throw new Error("project must be an object");
  if (input.kind !== "ims-atlas-project") throw new Error("invalid project kind");
  if (typeof input.savedAt !== "string") throw new Error("savedAt required");
  const config = parseAnalysisConfig(input.config);
  const file: ProjectFile = {
    kind: "ims-atlas-project",
    savedAt: input.savedAt,
    config,
  };
  if (typeof input.label === "string" && input.label.length <= 120) {
    file.label = input.label;
  }
  return file;
}

export const ProjectFileSchema = {
  parse(input: unknown): ProjectFile {
    return parseProjectFile(input);
  },
};
