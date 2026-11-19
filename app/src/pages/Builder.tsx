import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { hsLabel } from "../data/hsProducts";
import { useAnalysis } from "../state/useAnalysis";
import { COL_HS64_PRESET } from "../state/schema";

export function Builder() {
  const { t, i18n } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  return (
    <section
      className="builder"
      data-testid="builder-view"
      aria-labelledby="builder-title"
    >
      <h1 id="builder-title">{t("nav.builder")}</h1>
      <p>{t("builderIntro")}</p>
      <dl className="builder-summary" data-testid="builder-summary">
        <div>
          <dt>{t("origin")}</dt>
          <dd>{config.origin ?? "—"}</dd>
        </div>
        <div>
          <dt>{t("product")}</dt>
          <dd>{config.hs ? hsLabel(config.hs, lang) : "—"}</dd>
        </div>
        <div>
          <dt>{t("year")}</dt>
          <dd>{config.year ?? "—"}</dd>
        </div>
        <div>
          <dt>{t("region")}</dt>
          <dd>{config.region ?? "world"}</dd>
        </div>
        <div>
          <dt>{t("weightScheme")}</dt>
          <dd>{config.weightScheme ?? "expert_mean"}</dd>
        </div>
        <div>
          <dt>{t("normalization")}</dt>
          <dd>{config.normalization ?? "minmax"}</dd>
        </div>
        <div>
          <dt>{t("method")}</dt>
          <dd>{config.mcdm ?? "wsm"}</dd>
        </div>
        <div>
          <dt>{t("missingThreshold")}</dt>
          <dd>{config.missingThreshold ?? 0.2}</dd>
        </div>
      </dl>
      <p className="note">{t("builderHint")}</p>
      <p>
        <button
          type="button"
          data-testid="builder-load-preset"
          onClick={() => setConfig({ ...COL_HS64_PRESET, view: "builder", lang })}
        >
          {t("presetColHs64")}
        </button>{" "}
        <Link
          to="/ranking"
          data-testid="builder-to-ranking"
          onClick={() =>
            setConfig({
              ...config,
              view: "ranking",
              origin: config.origin ?? "COL",
              hs: config.hs ?? "64",
              year: config.year ?? 2023,
              weightScheme: config.weightScheme ?? "expert_mean",
              normalization: config.normalization ?? "minmax",
              mcdm: config.mcdm ?? "wsm",
              missingThreshold: config.missingThreshold ?? 0.2,
            })
          }
        >
          {t("openRanking")}
        </Link>
      </p>
    </section>
  );
}
