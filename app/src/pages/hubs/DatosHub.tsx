import {
  Database,
  FileSpreadsheet,
  GitBranch,
  Newspaper,
  Package,
  Shield,
} from "lucide-react";
import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import { useTranslation } from "../../i18n";
import type { ViewId } from "../../state/schema";

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

/** Datos — “¿Qué datos hay?” (read-only hub). */
export function DatosHub() {
  const { t } = useTranslation();
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
    </PageShell>
  );
}
