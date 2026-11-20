import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useLocation } from "react-router-dom";
import { version as APP_VERSION } from "@ims-atlas/core";
import { EmbeddedPanelContext } from "../components/EmbeddedContext";
import { GlobalSearch } from "../components/GlobalSearch";
import { PermalinkLink } from "../components/PermalinkLink";
import { dataConfig, releaseUrl } from "../dataConfig";
import { loadReleases } from "../data/transparency";
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
  const [liveRelease, setLiveRelease] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReleases()
      .then((payload) => {
        const current =
          typeof payload.current === "string" ? payload.current.trim() : "";
        const fromRow = payload.releases?.find(
          (r) => typeof r.version === "string" && String(r.version).trim(),
        )?.version;
        const resolved =
          current ||
          (typeof fromRow === "string" ? fromRow.trim() : "") ||
          dataConfig.release_version;
        if (!cancelled) setLiveRelease(resolved);
      })
      .catch(() => {
        if (!cancelled) setLiveRelease(dataConfig.release_version);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dataVersion = liveRelease ?? dataConfig.release_version;
  const manifestHref = dataVersion
    ? `${dataConfig.release_base_path}/v${dataVersion}/manifest.json`
    : releaseUrl("manifest.json");

  return (
    <section
      className="fuentes-page"
      data-testid="fuentes-datos"
      aria-labelledby="fuentes-datos-title"
    >
      <header className="fuentes-hero results-card">
        <p className="fuentes-kicker">{t("fuentesKicker")}</p>
        <h1 id="fuentes-datos-title">{t("fuentesTitle")}</h1>
        <p className="fuentes-lead">{t("fuentesLead")}</p>
        <div className="fuentes-toolbar">
          <GlobalSearch />
          <p className="fuentes-meta muted small" data-testid="data-versions">
            <span>
              {t("appVersion")}: <span data-testid="app-version">{APP_VERSION}</span>
            </span>
            <span className="fuentes-meta-sep" aria-hidden>
              ·
            </span>
            <span>
              {t("dataVersion")}:{" "}
              {dataVersion ? (
                <a href={manifestHref} data-testid="data-version-link">
                  v{dataVersion}
                </a>
              ) : (
                <span data-testid="data-version-link">—</span>
              )}
            </span>
            <span className="fuentes-meta-sep" aria-hidden>
              ·
            </span>
            <PermalinkLink view="changelog">{t("fuentesChangelog")}</PermalinkLink>
          </p>
        </div>
      </header>

      <nav
        className="fuentes-tabs"
        aria-label={t("fuentesTitle")}
        data-testid="fuentes-tabs"
      >
        {FUENTES_TABS.map((tab) => (
          <PermalinkLink
            key={tab.id}
            view="data_sources"
            hash={tab.id}
            className={`fuentes-tab${tab.id === active ? " is-active" : ""}`}
            aria-current={tab.id === active ? "page" : undefined}
            data-testid={`fuentes-tab-${tab.id}`}
          >
            {t(tab.labelKey)}
          </PermalinkLink>
        ))}
      </nav>

      <EmbeddedPanelContext.Provider value={true}>
        <Suspense fallback={<p className="muted">{t("loading")}</p>}>
          <div className="fuentes-panel" data-testid={`fuentes-panel-${active}`}>
            <Panel />
          </div>
        </Suspense>
      </EmbeddedPanelContext.Provider>
    </section>
  );
}
