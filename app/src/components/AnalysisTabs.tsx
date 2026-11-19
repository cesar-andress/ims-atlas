import { useTranslation } from "../i18n";
import { PermalinkLink } from "./PermalinkLink";
import { useAnalysis } from "../state/useAnalysis";
import type { ViewId } from "../state/schema";

const TABS: readonly ViewId[] = [
  "ranking",
  "factors",
  "compare",
  "matrix",
  "map",
  "uncertainty",
  "backtest",
  "time",
  "cite",
];

/** Shared sub-nav for the analysis workspace. */
export function AnalysisTabs() {
  const { t } = useTranslation();
  const { config } = useAnalysis();

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
        >
          {t(`nav.${view}`)}
        </PermalinkLink>
      ))}
    </nav>
  );
}
