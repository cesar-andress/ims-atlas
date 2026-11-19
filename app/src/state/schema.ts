/**
 * Permalink / project config schema without Zod (keeps Home JS lean).
 */

const VIEWS = [
  "home",
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
  "docs",
  "data_sources",
  "data_variable",
  "data_pipeline",
  "data_releases",
  "data_updates",
  "status",
  "factors",
  "compare",
] as const;

export type ViewId = (typeof VIEWS)[number];

const VIEW_SET = new Set<string>(VIEWS);

const NORMALIZATIONS = [
  "minmax",
  "ratio_legacy",
  "zscore",
  "rank",
  "log_minmax",
] as const;
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
  compareA?: string | undefined;
  compareB?: string | undefined;
  matrixCutoff?: "median" | "fixed" | undefined;
  matrixCutA?: number | undefined;
  matrixCutF?: number | undefined;
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
