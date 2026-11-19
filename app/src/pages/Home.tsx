import { version as APP_VERSION } from "@ims-atlas/core";
import { BarChart3, Database, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "../i18n";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { dataConfig, releaseUrl } from "../dataConfig";
import { COL_HS64_PRESET } from "../state/schema";

/** Home = three large steps: Datos → Variables → Análisis. */
export function Home() {
  const { t } = useTranslation();
  const status = t("statusNote")
    .replaceAll("{appVersion}", APP_VERSION)
    .replaceAll("{dataVersion}", dataConfig.release_version);

  return (
    <PageShell testId="home-view" titleKey="appName" className="hero">
      <p data-testid="home-tagline">{t("tagline")}</p>
      <p className="note" data-testid="home-status">
        {status}
      </p>
      <p className="note" data-testid="home-versions">
        {t("appVersion")}: <span data-testid="app-version">{APP_VERSION}</span>
        {" · "}
        {t("dataRelease")}:{" "}
        <a href={releaseUrl("manifest.json")}>v{dataConfig.release_version}</a>
      </p>

      <div
        className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4"
        data-testid="home-flow-cards"
      >
        <PermalinkLink
          view="datos"
          className="rounded-card border border-border bg-surface p-6 text-left no-underline transition-shadow duration-micro hover:shadow-md"
          data-testid="home-card-datos"
        >
          <Database className="mb-3 h-8 w-8 text-primary" aria-hidden />
          <h2 className="m-0 text-xl font-semibold text-ink">{t("homeCardDatos")}</h2>
          <p className="m-0 mt-2 text-sm text-ink-2">{t("homeCardDatosBody")}</p>
        </PermalinkLink>
        <PermalinkLink
          view="variables"
          replace={{ ...COL_HS64_PRESET, view: "variables" }}
          className="rounded-card border border-border bg-surface p-6 text-left no-underline transition-shadow duration-micro hover:shadow-md"
          data-testid="home-card-variables"
        >
          <SlidersHorizontal className="mb-3 h-8 w-8 text-primary" aria-hidden />
          <h2 className="m-0 text-xl font-semibold text-ink">
            {t("homeCardVariables")}
          </h2>
          <p className="m-0 mt-2 text-sm text-ink-2">{t("homeCardVariablesBody")}</p>
        </PermalinkLink>
        <PermalinkLink
          view="analisis"
          replace={{ ...COL_HS64_PRESET, view: "analisis" }}
          className="rounded-card border border-border bg-surface p-6 text-left no-underline transition-shadow duration-micro hover:shadow-md"
          data-testid="home-card-analisis"
        >
          <BarChart3 className="mb-3 h-8 w-8 text-primary" aria-hidden />
          <h2 className="m-0 text-xl font-semibold text-ink">
            {t("homeCardAnalisis")}
          </h2>
          <p className="m-0 mt-2 text-sm text-ink-2">{t("homeCardAnalisisBody")}</p>
        </PermalinkLink>
      </div>

      <p className="muted small mt-6" data-testid="home-limits">
        {t("homeWhatItSays")}
      </p>
    </PageShell>
  );
}
