import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dataConfig, releaseUrl } from "../dataConfig";
import { useAnalysis } from "../state/useAnalysis";
import { configToSearch } from "../state/urlState";
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
    v: 1,
    view: "builder",
    origin: "COL",
    year: 2023,
    hs: "64",
    weightScheme: "expert_mean",
    missingThreshold: 0.2,
  },
];

export function Home() {
  const { t } = useTranslation();
  const { setConfig } = useAnalysis();

  return (
    <section className="hero" aria-labelledby="home-title">
      <h1 id="home-title">{t("appName")}</h1>
      <p>{t("tagline")}</p>
      <p className="note">{t("statusNote")}</p>
      <p className="note">
        {t("dataRelease")}:{" "}
        <a href={releaseUrl("manifest.json")}>v{dataConfig.release_version}</a>
      </p>
      <h2>{t("examplePermalinks")}</h2>
      <ul className="permalink-list" data-testid="example-permalinks">
        {EXAMPLES.map((ex, i) => {
          const search = configToSearch(ex);
          const path = ex.view === "home" ? "/" : `/${ex.view}`;
          return (
            <li key={i}>
              <Link
                to={{ pathname: path, search }}
                onClick={() => setConfig(ex)}
                data-testid={`permalink-example-${i}`}
              >
                {ex.origin}/{ex.year} → {ex.view}
              </Link>
            </li>
          );
        })}
      </ul>
      <p>
        <Link to="/catalog" onClick={() => setConfig({ view: "catalog" })}>
          {t("nav.catalog")}
        </Link>
      </p>
    </section>
  );
}
