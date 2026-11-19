import { PermalinkLink } from "./PermalinkLink";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { PRIMARY_VIEWS, SECONDARY_VIEWS } from "../state/views";
import type { ViewId } from "../state/schema";

const PREFETCH: Partial<Record<ViewId, () => Promise<unknown>>> = {
  ranking: () => import("../pages/Ranking"),
  matrix: () => import("../pages/Matrix"),
  map: () => import("../pages/MarketMap"),
  catalog: () => import("../pages/Catalog"),
  builder: () => import("../pages/Builder"),
  uncertainty: () => import("../pages/Uncertainty"),
  backtest: () => import("../pages/Backtest"),
  time: () => import("../pages/TimeExplorer"),
  cite: () => import("../pages/CiteExport"),
  byod: () => import("../pages/Byod"),
  docs: () => import("../pages/Docs"),
  status: () => import("../pages/transparency/DataStatus"),
  data_sources: () => import("../pages/transparency/DataSources"),
  data_variable: () => import("../pages/transparency/DataVariable"),
  data_pipeline: () => import("../pages/transparency/DataPipeline"),
  data_releases: () => import("../pages/transparency/DataReleases"),
};

function NavItem({ view }: { view: ViewId }) {
  const { t } = useTranslation();
  const { config } = useAnalysis();

  return (
    <PermalinkLink
      view={view}
      className={config.view === view ? "active" : undefined}
      onMouseEnter={() => {
        const load = PREFETCH[view];
        if (load) void load();
      }}
    >
      {t(`nav.${view}`)}
    </PermalinkLink>
  );
}

/** Primary + collapsed secondary nav (avoids 12 always-visible stub links). */
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
        <details className="nav-more" {...(secondaryOpen ? { open: true } : {})}>
          <summary>{t("navMore")}</summary>
          <div className="nav-more-panel">
            {SECONDARY_VIEWS.map((view) => (
              <NavItem key={view} view={view} />
            ))}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
