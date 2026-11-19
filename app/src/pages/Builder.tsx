import { AnalysisPage } from "../components/AnalysisPage";
import { AnalysisSummary } from "../components/AnalysisSummary";
import { PermalinkLink } from "../components/PermalinkLink";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";
import { COL_HS64_PRESET } from "../state/schema";
import { isAnalysisReady } from "../state/views";

export function Builder() {
  const { t, i18n } = useTranslation();
  const { config, replaceConfig } = useAnalysis();
  const { model, error } = useRankingModel();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const rankingReady = isAnalysisReady(config);

  return (
    <AnalysisPage
      testId="builder-view"
      titleKey="nav.builder"
      intro={t("builderIntro")}
      model={model}
      error={error}
      allowWithoutModel
    >
      {() => (
        <div className="builder-body">
          <AnalysisSummary />
          <p className="note">{t("builderHint")}</p>
          <p className="analysis-actions">
            <button
              type="button"
              data-testid="builder-load-preset"
              onClick={() =>
                replaceConfig({ ...COL_HS64_PRESET, view: "builder", lang })
              }
            >
              {t("presetColHs64")}
            </button>{" "}
            {rankingReady ? (
              <PermalinkLink
                view="ranking"
                patch={{
                  origin: config.origin,
                  hs: config.hs,
                  year: config.year,
                  weightScheme: config.weightScheme ?? "expert_mean",
                  normalization: config.normalization ?? "minmax",
                  mcdm: config.mcdm ?? "wsm",
                  missingThreshold: config.missingThreshold ?? 0.2,
                }}
                data-testid="builder-to-ranking"
              >
                {t("openRanking")}
              </PermalinkLink>
            ) : (
              <span className="muted" data-testid="builder-ranking-blocked">
                {t("builderNeedProduct")}
              </span>
            )}
            {" · "}
            <PermalinkLink view="status">{t("nav.status")}</PermalinkLink>
            {" · "}
            <PermalinkLink view="catalog">{t("nav.catalog")}</PermalinkLink>
          </p>
        </div>
      )}
    </AnalysisPage>
  );
}
