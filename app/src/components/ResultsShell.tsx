import type { ReactNode } from "react";
import { useTranslation } from "../i18n";
import { prefetchAnalysisRoute } from "../ranking/prefetchRoutes";
import type { ViewId } from "../state/schema";
import { PermalinkLink } from "./PermalinkLink";

export type ResultTab = "ranking" | "matrix" | "map" | "compare" | "time" | "backtest";

const TABS: readonly { id: ResultTab; view: ViewId; labelKey: string }[] = [
  { id: "ranking", view: "ranking", labelKey: "resultsTabRanking" },
  { id: "matrix", view: "matrix", labelKey: "resultsTabMatrix" },
  { id: "map", view: "map", labelKey: "resultsTabMap" },
  { id: "compare", view: "compare", labelKey: "resultsTabCompare" },
  { id: "time", view: "time", labelKey: "resultsTabTime" },
  { id: "backtest", view: "backtest", labelKey: "resultsTabBacktest" },
];

/**
 * Step 3 frame: tab row over the existing read-only result views.
 * Deep routes (/ranking, /matrix, ...) stay valid permalinks; the shell only
 * adds navigation and a pointer to step 2 (the one place to change the analysis).
 */
export function ResultsShell({
  tab,
  children,
}: {
  tab: ResultTab | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="results-shell" data-testid="results-shell">
      <div className="card results-tabs-card">
        <nav className="tabs" aria-label={t("resultsTabs")} data-testid="results-tabs">
          {TABS.map(({ id, view, labelKey }) => (
            <PermalinkLink
              key={id}
              view={view}
              className="tab"
              aria-current={tab === id ? "page" : undefined}
              data-testid={`results-tab-${id}`}
              onMouseEnter={() => prefetchAnalysisRoute(view)}
              onFocus={() => prefetchAnalysisRoute(view)}
            >
              {t(labelKey)}
            </PermalinkLink>
          ))}
          <span className="spacer" />
          <span className="results-readonly-note" data-testid="results-readonly-note">
            {t("resultsReadOnly")}{" "}
            <PermalinkLink view="variables" data-testid="results-go-step2">
              {t("resultsGoStep2")}
            </PermalinkLink>
          </span>
        </nav>
      </div>
      {children}
    </div>
  );
}
