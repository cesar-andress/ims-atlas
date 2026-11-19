import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { configToSearch, pathForView } from "../state/urlState";
import { PRIMARY_VIEWS, SECONDARY_VIEWS } from "../state/views";
import type { ViewId } from "../state/schema";

const PREFETCH: Partial<Record<ViewId, () => Promise<unknown>>> = {
  ranking: () => import("../pages/Ranking"),
  matrix: () => import("../pages/Matrix"),
  map: () => import("../pages/MarketMap"),
  catalog: () => import("../pages/Catalog"),
  builder: () => import("../pages/Builder"),
};

function NavItem({ view }: { view: ViewId }) {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const to = {
    pathname: pathForView(view),
    search: configToSearch({ ...config, view }),
  };

  return (
    <Link
      to={to}
      className={config.view === view ? "active" : undefined}
      onMouseEnter={() => {
        const load = PREFETCH[view];
        if (load) void load();
      }}
    >
      {t(`nav.${view}`)}
    </Link>
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
      <details className="nav-more" {...(secondaryOpen ? { open: true } : {})}>
        <summary>{t("navMore")}</summary>
        <div className="nav-more-panel">
          {SECONDARY_VIEWS.map((view) => (
            <NavItem key={view} view={view} />
          ))}
        </div>
      </details>
    </nav>
  );
}
