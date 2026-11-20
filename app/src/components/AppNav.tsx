import { PermalinkLink } from "./PermalinkLink";
import { useTranslation } from "../i18n";
import { prefetchAnalysisRoute } from "../ranking/prefetchRoutes";
import { useAnalysis } from "../state/useAnalysis";
import { PRIMARY_VIEWS, SECONDARY_GROUPS, SECONDARY_VIEWS } from "../state/views";
import type { ViewId } from "../state/schema";

function NavItem({ view }: { view: ViewId }) {
  const { t } = useTranslation();
  const { config } = useAnalysis();

  return (
    <PermalinkLink
      view={view}
      className={config.view === view ? "active" : undefined}
      onMouseEnter={() => prefetchAnalysisRoute(view)}
      onFocus={() => prefetchAnalysisRoute(view)}
    >
      {t(`nav.${view}`)}
    </PermalinkLink>
  );
}

/** Primary + collapsed secondary nav (≤7 links, grouped; R2). */
export function AppNav() {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const secondaryOpen = SECONDARY_VIEWS.includes(config.view);

  return (
    <nav className="main-nav" aria-label={t("mainNav")} data-testid="main-nav">
      {PRIMARY_VIEWS.map((view) => (
        <NavItem key={view} view={view} />
      ))}
      {SECONDARY_VIEWS.length > 0 ? (
        <details
          className={secondaryOpen ? "nav-more has-secondary-active" : "nav-more"}
          data-testid="nav-more"
          data-secondary-count={SECONDARY_VIEWS.length}
        >
          <summary className={secondaryOpen ? "active" : undefined}>
            {t("navMore")}
          </summary>
          <div className="nav-more-panel">
            {SECONDARY_GROUPS.map((group) => (
              <div key={group.labelKey} className="nav-more-group">
                <p className="nav-more-group-label muted small">{t(group.labelKey)}</p>
                {group.views.map((view) => (
                  <NavItem key={view} view={view} />
                ))}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
