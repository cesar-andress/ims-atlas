import { useTranslation } from "../i18n";
import { prefetchAnalysisRoute } from "../ranking/prefetchRoutes";
import { prefetchRanking } from "../ranking/rankingCache";
import { rankingRequestFromConfig } from "../ranking/rankingRequest";
import { useAnalysis } from "../state/useAnalysis";
import type { ViewId } from "../state/schema";
import { isAnalysisReady } from "../state/views";
import { PermalinkLink } from "./PermalinkLink";

const TABS: readonly ViewId[] = [
  "builder",
  "ranking",
  "factors",
  "compare",
  "matrix",
  "map",
  "uncertainty",
  "backtest",
  "time",
  "cite",
  "norm_lab",
];

/** Shared sub-nav for the analysis workspace. */
export function AnalysisTabs() {
  const { t } = useTranslation();
  const { config } = useAnalysis();

  function warm(view: ViewId) {
    prefetchAnalysisRoute(view);
    if (isAnalysisReady(config)) {
      prefetchRanking(rankingRequestFromConfig(config));
    }
  }

  return (
    <nav
      className="analysis-tabs"
      aria-label={t("analysisViews")}
      data-testid="analysis-tabs"
    >
      {TABS.map((view) => (
        <PermalinkLink
          key={view}
          view={view}
          className={config.view === view ? "active" : undefined}
          onMouseEnter={() => warm(view)}
          onFocus={() => warm(view)}
        >
          {t(`nav.${view}`)}
        </PermalinkLink>
      ))}
    </nav>
  );
}
