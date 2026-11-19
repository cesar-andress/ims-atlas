import type { AnalysisConfig, ViewId } from "./schema";

/** Information flow: Datos · Variables · Análisis · Proyectos. */
export const PRIMARY_VIEWS: readonly ViewId[] = [
  "datos",
  "variables",
  "analisis",
  "projects",
] as const;

/** Secondary tools under “More” (docs / transparency / labs). */
export const SECONDARY_VIEWS: readonly ViewId[] = [
  "design",
  "docs",
  "cite",
  "byod",
  "paper",
  "changelog",
  "catalog",
  "explore",
  "sql",
  "norm_lab",
  "status",
  "data_sources",
  "data_pipeline",
  "data_releases",
  "data_updates",
  "project_dashboard",
  "project_variables",
  "project_coverage",
] as const;

/** Views that share the analysis config panel + ranking model. */
export const ANALYSIS_VIEWS: readonly ViewId[] = [
  "variables",
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
  "analisis",
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

/** Result screens must not show config (GUI simplicity rule). */
export function isResultsView(view: ViewId): boolean {
  return (
    view === "ranking" ||
    view === "matrix" ||
    view === "map" ||
    view === "uncertainty" ||
    view === "backtest" ||
    view === "time" ||
    view === "compare" ||
    view === "factors"
  );
}
