import { useMemo } from "react";
import {
  Database,
  FileSpreadsheet,
  GitBranch,
  Newspaper,
  Package,
  Shield,
} from "lucide-react";
import { CoverageHeatmap } from "../../components/CoverageHeatmap";
import { LicenceBadge } from "../../components/LicenceBadge";
import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import { loadCatalogPreview } from "../../data/catalogLoader";
import type { CatalogVariable } from "../../data/types";
import { useTranslation } from "../../i18n";
import type { ViewId } from "../../state/schema";
import { useAsyncResource } from "../../state/useAsyncResource";

const LINKS: {
  view: ViewId;
  icon: typeof Database;
  titleKey: string;
  bodyKey: string;
}[] = [
  {
    view: "catalog",
    icon: Database,
    titleKey: "hubDatosCatalog",
    bodyKey: "hubDatosCatalogBody",
  },
  {
    view: "data_sources",
    icon: Shield,
    titleKey: "hubDatosSources",
    bodyKey: "hubDatosSourcesBody",
  },
  {
    view: "imsfe_import",
    icon: FileSpreadsheet,
    titleKey: "hubDatosImsfeImport",
    bodyKey: "hubDatosImsfeImportBody",
  },
  {
    view: "ai_verify",
    icon: Shield,
    titleKey: "hubDatosAiVerify",
    bodyKey: "hubDatosAiVerifyBody",
  },
  {
    view: "status",
    icon: GitBranch,
    titleKey: "hubDatosStatus",
    bodyKey: "hubDatosStatusBody",
  },
  {
    view: "data_releases",
    icon: Package,
    titleKey: "hubDatosReleases",
    bodyKey: "hubDatosReleasesBody",
  },
  {
    view: "data_updates",
    icon: Newspaper,
    titleKey: "hubDatosUpdates",
    bodyKey: "hubDatosUpdatesBody",
  },
  {
    view: "explore",
    icon: Database,
    titleKey: "hubDatosExplore",
    bodyKey: "hubDatosExploreBody",
  },
];

function varName(v: CatalogVariable, lang: "en" | "es"): string {
  if (typeof v.name === "string") return v.name;
  return v.name[lang] ?? v.id;
}

/** Datos — “¿Qué datos hay?” (read-only hub + variable cards from catalog). */
export function DatosHub() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const {
    data: catalog,
    loading,
    error,
  } = useAsyncResource(() => loadCatalogPreview(), []);

  const byFactor = useMemo(() => {
    const map = new Map<string, CatalogVariable[]>();
    for (const v of catalog?.variables ?? []) {
      const list = map.get(v.factor) ?? [];
      list.push(v);
      map.set(v.factor, list);
    }
    return [...map.entries()];
  }, [catalog]);

  return (
    <PageShell testId="datos-hub" titleKey="nav.datos">
      <p className="muted">{t("hubDatosIntro")}</p>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {LINKS.map(({ view, icon: Icon, titleKey, bodyKey }) => (
          <PermalinkLink
            key={view}
            view={view}
            className="rounded-card border border-border bg-surface p-4 text-left no-underline transition-shadow duration-micro hover:shadow-md"
            data-testid={`datos-card-${view}`}
          >
            <Icon className="mb-2 h-6 w-6 text-primary" aria-hidden />
            <h2 className="m-0 text-base font-semibold text-ink">{t(titleKey)}</h2>
            <p className="m-0 mt-1 text-sm text-ink-2">{t(bodyKey)}</p>
          </PermalinkLink>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">{t("hubDatosVariables")}</h2>
      {loading ? <p className="muted">{t("loading")}</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && byFactor.length === 0 ? (
        <p className="muted" data-testid="datos-vars-empty">
          {t("hubDatosVariablesEmpty")}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-6" data-testid="datos-variable-cards">
        {byFactor.map(([factor, vars]) => (
          <section key={factor}>
            <h3 className="m-0 text-sm font-semibold uppercase tracking-wide text-ink-3">
              {factor}
            </h3>
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {vars.map((v) => (
                <article
                  key={v.id}
                  className="rounded-card border border-border bg-surface p-4"
                  data-testid={`datos-var-${v.id}`}
                >
                  <h4 className="m-0 text-base font-semibold text-ink">
                    {varName(v, lang)}
                  </h4>
                  <p className="m-0 mt-1 text-sm text-ink-2">{v.citation ?? v.id}</p>
                  <p className="muted small m-0 mt-2">
                    {(v.source_ids ?? []).join(", ") || "—"}
                  </p>
                  <div className="badge-row mt-1">
                    {(v.licence_ids ?? []).map((lic) => (
                      <LicenceBadge key={`${v.id}-${lic}`} licenceId={lic} />
                    ))}
                  </div>
                  <div className="mt-2">
                    <CoverageHeatmap variable={v} />
                  </div>
                  <p className="m-0 mt-2">
                    <PermalinkLink
                      view="data_variable"
                      patch={{ focusVariable: v.id }}
                      className="text-sm"
                      data-testid={`datos-verify-${v.id}`}
                    >
                      {t("hubDatosVerify")}
                    </PermalinkLink>
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
