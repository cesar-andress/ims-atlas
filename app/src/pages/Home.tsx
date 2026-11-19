import { useTranslation } from "../i18n";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { dataConfig, releaseUrl } from "../dataConfig";
import { COL_HS64_PRESET, type AnalysisConfig } from "../state/schema";

const EXAMPLES: AnalysisConfig[] = [
  {
    v: 1,
    view: "catalog",
    origin: "COL",
    year: 2019,
    lang: "en",
  },
  {
    ...COL_HS64_PRESET,
    view: "ranking",
  },
  {
    ...COL_HS64_PRESET,
    view: "matrix",
    matrixCutoff: "median",
  },
];

export function Home() {
  const { t } = useTranslation();

  return (
    <PageShell testId="home-view" titleKey="appName" className="hero">
      <p>{t("tagline")}</p>
      <p className="note">{t("statusNote")}</p>
      <p className="note">
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
          view="ranking"
          replace={{ ...COL_HS64_PRESET, view: "ranking" }}
          data-testid="home-open-demo"
        >
          {t("presetColHs64")}
        </PermalinkLink>
      </div>
      <h2>{t("examplePermalinks")}</h2>
      <ul className="permalink-list" data-testid="example-permalinks">
        {EXAMPLES.map((ex, i) => (
          <li key={i}>
            <PermalinkLink
              view={ex.view}
              replace={ex}
              data-testid={`permalink-example-${i}`}
            >
              {ex.origin}/{ex.year} → {ex.view}
            </PermalinkLink>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
