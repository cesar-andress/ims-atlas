import type { AnalysisConfig, ViewId } from "./schema";

/** Primary workspace views (shown in the main nav). */
export const PRIMARY_VIEWS: readonly ViewId[] = [
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
  "factors",
  "compare",
  "projects",
] as const;

/** Transparency / pipeline views (SPEC §10.4) under More. */
export const SECONDARY_VIEWS: readonly ViewId[] = [
  "project_dashboard",
  "project_variables",
  "project_coverage",
  "norm_lab",
  "status",
  "data_sources",
  "data_variable",
  "data_pipeline",
  "data_releases",
  "data_updates",
] as const;

/** Views that share the analysis config panel + ranking model. */
export const ANALYSIS_VIEWS: readonly ViewId[] = [
  "builder",
  "ranking",
  "matrix",
  "map",
  "uncertainty",
  "backtest",
  "time",
  "cite",
  "factors",
  "compare",
  "norm_lab",
  "project_variables",
  "project_coverage",
  "project_dashboard",
] as const;

export function isAnalysisView(view: ViewId): boolean {
  return (ANALYSIS_VIEWS as readonly string[]).includes(view);
}

export function isPrimaryView(view: ViewId): boolean {
  return (PRIMARY_VIEWS as readonly string[]).includes(view);
}

/** Ranking / matrix / map need origin + HS + year before computing. */
export function isAnalysisReady(config: AnalysisConfig): boolean {
  return Boolean(config.origin && config.hs && config.year);
}
