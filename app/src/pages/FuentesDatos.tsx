import { lazy, Suspense, useMemo, type ComponentType } from "react";
import { useLocation } from "react-router-dom";
import { version as APP_VERSION } from "@ims-atlas/core";
import { EmbeddedPanelContext } from "../components/EmbeddedContext";
import { GlobalSearch } from "../components/GlobalSearch";
import { PermalinkLink } from "../components/PermalinkLink";
import { dataConfig, releaseUrl } from "../dataConfig";
import { useTranslation } from "../i18n";

const DataSources = lazy(() =>
  import("./transparency/DataSources").then((m) => ({ default: m.DataSources })),
);
const Catalog = lazy(() => import("./Catalog").then((m) => ({ default: m.Catalog })));
const DataReleases = lazy(() =>
  import("./transparency/DataReleases").then((m) => ({ default: m.DataReleases })),
);
const DataUpdates = lazy(() =>
  import("./transparency/DataUpdates").then((m) => ({ default: m.DataUpdates })),
);
const DataStatus = lazy(() =>
  import("./transparency/DataStatus").then((m) => ({ default: m.DataStatus })),
);
const Explore = lazy(() => import("./Explore").then((m) => ({ default: m.Explore })));

const FUENTES_TABS = [
  { id: "fuentes", labelKey: "fuentesTabSources", Panel: DataSources },
  { id: "catalogo", labelKey: "fuentesTabCatalog", Panel: Catalog },
  { id: "versiones", labelKey: "fuentesTabVersions", Panel: DataReleases },
  { id: "novedades", labelKey: "fuentesTabUpdates", Panel: DataUpdates },
  { id: "estado", labelKey: "fuentesTabStatus", Panel: DataStatus },
  { id: "explorar", labelKey: "fuentesTabExplore", Panel: Explore },
] as const satisfies readonly {
  id: string;
  labelKey: string;
  Panel: ComponentType;
}[];

type TabId = (typeof FUENTES_TABS)[number]["id"];

/**
 * One page for everything about where the data comes from: sources, catalogue,
 * data versions, updates, update status and the explorer. Tabs follow the URL hash.
 */
export function FuentesDatos() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const active: TabId = useMemo(() => {
    const id = hash.replace(/^#/, "");
    return FUENTES_TABS.find((tab) => tab.id === id)?.id ?? "fuentes";
  }, [hash]);
  const Panel = FUENTES_TABS.find((tab) => tab.id === active)!.Panel;

  return (
    <section data-testid="fuentes-datos" aria-labelledby="fuentes-datos-title">
      <h1 id="fuentes-datos-title">{t("fuentesTitle")}</h1>
      <p className="lead">{t("fuentesLead")}</p>
      <GlobalSearch />
      <p className="muted small" data-testid="data-versions">
        {t("appVersion")}: <span data-testid="app-version">{APP_VERSION}</span> ·{" "}
        {t("dataVersion")}:{" "}
        <a href={releaseUrl("manifest.json")} data-testid="data-version-link">
          v{dataConfig.release_version}
        </a>{" "}
        · <PermalinkLink view="changelog">{t("fuentesChangelog")}</PermalinkLink>
      </p>
      <nav className="tabs" aria-label={t("fuentesTitle")} data-testid="fuentes-tabs">
        {FUENTES_TABS.map((tab) => (
          <PermalinkLink
            key={tab.id}
            view="data_sources"
            hash={tab.id}
            className="tab"
            aria-current={tab.id === active ? "page" : undefined}
            data-testid={`fuentes-tab-${tab.id}`}
          >
            {t(tab.labelKey)}
          </PermalinkLink>
        ))}
      </nav>
      <EmbeddedPanelContext.Provider value={true}>
        <Suspense fallback={<p className="muted">{t("loading")}</p>}>
          <div data-testid={`fuentes-panel-${active}`}>
            <Panel />
          </div>
        </Suspense>
      </EmbeddedPanelContext.Provider>
    </section>
  );
}
