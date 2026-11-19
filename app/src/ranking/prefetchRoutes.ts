import type { ViewId } from "../state/schema";

/** Lazy route loaders (warm JS cache on hover / idle). */
const PREFETCH: Partial<Record<ViewId, () => Promise<unknown>>> = {
  builder: () => import("../pages/Builder"),
  ranking: () => import("../pages/Ranking"),
  factors: () => import("../pages/Factors"),
  compare: () => import("../pages/Compare"),
  matrix: () => import("../pages/Matrix"),
  map: () => import("../pages/MarketMap"),
  uncertainty: () => import("../pages/Uncertainty"),
  backtest: () => import("../pages/Backtest"),
  time: () => import("../pages/TimeExplorer"),
  cite: () => import("../pages/CiteExport"),
  catalog: () => import("../pages/Catalog"),
  byod: () => import("../pages/Byod"),
  docs: () => import("../pages/Docs"),
  norm_lab: () => import("../pages/NormLab"),
  projects: () => import("../pages/Projects"),
  explore: () => import("../pages/Explore"),
  explore_analysis: () => import("../pages/ExploreAnalysis"),
  country: () => import("../pages/CountryProfile"),
  sql: () => import("../pages/SqlConsole"),
  project_variables: () => import("../pages/ProjectVariables"),
  project_coverage: () => import("../pages/ProjectCoverage"),
  project_dashboard: () => import("../pages/ProjectDashboard"),
  status: () => import("../pages/transparency/DataStatus"),
  data_sources: () => import("../pages/transparency/DataSources"),
  data_variable: () => import("../pages/transparency/DataVariable"),
  data_pipeline: () => import("../pages/transparency/DataPipeline"),
  data_releases: () => import("../pages/transparency/DataReleases"),
};

const warmed = new Set<ViewId>();

export function prefetchAnalysisRoute(view: ViewId): void {
  if (warmed.has(view)) return;
  const load = PREFETCH[view];
  if (!load) return;
  warmed.add(view);
  void load().catch(() => {
    warmed.delete(view);
  });
}

/** Warm the most common entry chunks after first paint. */
export function prefetchCriticalRoutes(): void {
  prefetchAnalysisRoute("builder");
  prefetchAnalysisRoute("ranking");
  prefetchAnalysisRoute("catalog");
  void import("../components/ConfigPanel").catch(() => undefined);
}
