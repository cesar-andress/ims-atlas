import type { AnalysisConfig, ViewId } from "./schema";

/** The three project steps: 1 Datos · 2 Variables y pesos · 3 Resultados. */
export const PROJECT_STEP_VIEWS: readonly ViewId[] = [
  "datos",
  "variables",
  "analisis",
] as const;

export type ProjectStep = 1 | 2 | 3;

/** Result screens reachable from the Resultados tabs (and by permalink). */
export const RESULT_VIEWS: readonly ViewId[] = [
  "analisis",
  "ranking",
  "matrix",
  "map",
  "compare",
  "time",
  "backtest",
  "uncertainty",
  "factors",
] as const;

/** Project screens show the project bar; bare Home and static pages do not. */
export function isProjectScreen(view: ViewId): boolean {
  return (
    view === "datos" ||
    view === "variables" ||
    view === "builder" ||
    (RESULT_VIEWS as readonly string[]).includes(view)
  );
}

/** Which of the three steps a view belongs to (null outside a project step). */
export function projectStepOf(view: ViewId): ProjectStep | null {
  if (view === "datos") return 1;
  if (view === "variables" || view === "builder") return 2;
  if ((RESULT_VIEWS as readonly string[]).includes(view)) return 3;
  return null;
}

/** Views that share the analysis config panel + ranking model. */
export const ANALYSIS_VIEWS: readonly ViewId[] = [
  "datos",
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
