import { z } from "zod";

/** Views from SPEC §6 (nav + URL state). */
export const ViewIdSchema = z.enum([
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
]);

export type ViewId = z.infer<typeof ViewIdSchema>;

export const AnalysisConfigSchema = z.object({
  /** Schema version for permalinks. */
  v: z.literal(1),
  view: ViewIdSchema.default("home"),
  origin: z.string().length(3).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  hs: z.string().min(2).max(6).optional(),
  region: z.string().min(1).max(32).optional(),
  minImports: z.number().min(0).optional(),
  normalization: z
    .enum(["minmax", "ratio_legacy", "zscore", "rank", "log_minmax"])
    .optional(),
  mcdm: z.enum(["wsm", "topsis", "vikor", "promethee_ii"]).optional(),
  weightScheme: z
    .enum(["equal", "manual", "expert_mean", "entropy", "critic"])
    .optional(),
  missingThreshold: z.number().min(0).max(1).optional(),
  variableIds: z.array(z.string().min(1)).max(64).optional(),
  /** Manual factor weights (renormalised when applied). */
  factorWeights: z.record(z.string(), z.number()).optional(),
  compareA: z.string().length(3).optional(),
  compareB: z.string().length(3).optional(),
  lang: z.enum(["en", "es"]).optional(),
});

export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>;

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

export const ProjectFileSchema = z.object({
  kind: z.literal("ims-atlas-project"),
  savedAt: z.string(),
  config: AnalysisConfigSchema,
  label: z.string().max(120).optional(),
});

export type ProjectFile = z.infer<typeof ProjectFileSchema>;
