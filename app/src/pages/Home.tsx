import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { dataConfig, releaseUrl } from "../dataConfig";
import { configToSearch, pathForView } from "../state/urlState";
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
    <section className="hero" aria-labelledby="home-title">
      <h1 id="home-title">{t("appName")}</h1>
      <p>{t("tagline")}</p>
      <p className="note">{t("statusNote")}</p>
      <p className="note">
        {t("dataRelease")}:{" "}
        <a href={releaseUrl("manifest.json")}>v{dataConfig.release_version}</a>
      </p>
      <div className="home-cta">
        <Link
          className="cta-primary"
          to={{
            pathname: pathForView("builder"),
            search: configToSearch({ ...COL_HS64_PRESET, view: "builder" }),
          }}
          data-testid="home-start-builder"
        >
          {t("homeStart")}
        </Link>
        <Link
          to={{
            pathname: pathForView("ranking"),
            search: configToSearch({ ...COL_HS64_PRESET, view: "ranking" }),
          }}
          data-testid="home-open-demo"
        >
          {t("presetColHs64")}
        </Link>
      </div>
      <h2>{t("examplePermalinks")}</h2>
      <ul className="permalink-list" data-testid="example-permalinks">
        {EXAMPLES.map((ex, i) => {
          const search = configToSearch(ex);
          return (
            <li key={i}>
              <Link
                to={{ pathname: pathForView(ex.view), search }}
                data-testid={`permalink-example-${i}`}
              >
                {ex.origin}/{ex.year} → {ex.view}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
