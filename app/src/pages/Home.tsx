import { version as APP_VERSION } from "@ims-atlas/core";
import { useTranslation } from "../i18n";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { dataConfig, releaseUrl } from "../dataConfig";
import { COL_HS64_PRESET, type AnalysisConfig } from "../state/schema";

type HomeExample = AnalysisConfig & { label: string };

const EXAMPLES: HomeExample[] = [
  {
    label: "COL · HS64 · 2023 · footwear (paper demo)",
    ...COL_HS64_PRESET,
    view: "builder",
  },
  {
    label: "ESP · 1509 · 2022 · olive oil",
    v: 1,
    view: "builder",
    origin: "ESP",
    hs: "1509",
    year: 2022,
    lang: "en",
    normalization: "minmax",
    mcdm: "wsm",
    weightScheme: "expert_mean",
    missingThreshold: 0.2,
  },
  {
    label: "DEU · 8703 · 2022 · motor cars",
    v: 1,
    view: "builder",
    origin: "DEU",
    hs: "8703",
    year: 2022,
    lang: "en",
    normalization: "minmax",
    mcdm: "wsm",
    weightScheme: "expert_mean",
    missingThreshold: 0.2,
  },
  {
    ...COL_HS64_PRESET,
    view: "status",
    label: "COL · HS64 → data status",
  },
];

export function Home() {
  const { t } = useTranslation();
  const status = t("statusNote")
    .replaceAll("{appVersion}", APP_VERSION)
    .replaceAll("{dataVersion}", dataConfig.release_version);

  return (
    <PageShell testId="home-view" titleKey="appName" className="hero">
      <p>{t("tagline")}</p>
      <p className="note" data-testid="home-status">
        {status}
      </p>
      <p className="note" data-testid="home-versions">
        {t("appVersion")}: <span data-testid="app-version">{APP_VERSION}</span>
        {" · "}
        {t("dataRelease")}:{" "}
        <a href={releaseUrl("manifest.json")}>v{dataConfig.release_version}</a>
      </p>
      <div className="home-cta">
        <PermalinkLink
          view="builder"
          replace={{ ...COL_HS64_PRESET, view: "builder" }}
          className="cta-primary"
          data-testid="home-start-builder"
        >
          {t("homeStart")}
        </PermalinkLink>
        <PermalinkLink
          view="status"
          replace={{ ...COL_HS64_PRESET, view: "status" }}
          data-testid="home-open-status"
        >
          {t("homeOpenStatus")}
        </PermalinkLink>
      </div>
      <h2>{t("examplePermalinks")}</h2>
      <p className="muted small" data-testid="home-examples-intro">
        {t("homeExamplesIntro")}
      </p>
      <ul className="permalink-list" data-testid="example-permalinks">
        {EXAMPLES.map((ex, i) => {
          const { label, ...cfg } = ex;
          return (
            <li key={i}>
              <PermalinkLink
                view={cfg.view}
                replace={cfg}
                data-testid={`permalink-example-${i}`}
              >
                {label}
              </PermalinkLink>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
