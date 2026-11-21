import type { AnalysisConfig, ViewId } from "./schema";

/** Six project steps (Prompt 4d): Datos → … → Preparar envío. */
export const PROJECT_STEP_VIEWS: readonly ViewId[] = [
  "datos",
  "variables",
  "analisis",
  "mercado_objetivo",
  "plan_4p",
  "preparar_envio",
] as const;

export type ProjectStep = 1 | 2 | 3 | 4 | 5 | 6;

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
    view === "mercado_objetivo" ||
    view === "plan_4p" ||
    view === "preparar_envio" ||
    (RESULT_VIEWS as readonly string[]).includes(view)
  );
}

/** Which of the six steps a view belongs to (null outside a project step). */
export function projectStepOf(view: ViewId): ProjectStep | null {
  if (view === "datos") return 1;
  if (view === "variables" || view === "builder") return 2;
  if ((RESULT_VIEWS as readonly string[]).includes(view)) return 3;
  if (view === "mercado_objetivo") return 4;
  if (view === "plan_4p") return 5;
  if (view === "preparar_envio") return 6;
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
  "mercado_objetivo",
  "plan_4p",
  "preparar_envio",
] as const;

export function isAnalysisView(view: ViewId): boolean {
  return (ANALYSIS_VIEWS as readonly string[]).includes(view);
}

/** Ranking / matrix / map need origin + HS + year before computing. */
export function isAnalysisReady(config: AnalysisConfig): boolean {
  return Boolean(config.origin && config.hs && config.year);
}

/** Canonical screen after opening a project (modern chrome, not legacy dashboard). */
export function preferredProjectView(config: AnalysisConfig): ViewId {
  return isAnalysisReady(config) ? "analisis" : "datos";
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
