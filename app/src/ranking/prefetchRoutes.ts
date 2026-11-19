import type { ViewId } from "../state/schema";

/** Lazy route loaders for analysis tabs (warm JS cache on hover). */
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
