import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import { AnalysisSummary } from "../components/AnalysisSummary";
import { PageShell } from "../components/PageShell";
import { useAnalysis } from "../state/useAnalysis";
import { COL_HS64_PRESET } from "../state/schema";
import { configToSearch } from "../state/urlState";

export function Builder() {
  const { t, i18n } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const rankingTo = {
    pathname: "/ranking",
    search: configToSearch({
      ...config,
      view: "ranking",
      origin: config.origin ?? "COL",
      hs: config.hs ?? "64",
      year: config.year ?? 2023,
      weightScheme: config.weightScheme ?? "expert_mean",
      normalization: config.normalization ?? "minmax",
      mcdm: config.mcdm ?? "wsm",
      missingThreshold: config.missingThreshold ?? 0.2,
    }),
  };

  return (
    <PageShell
      testId="builder-view"
      titleKey="nav.builder"
      className="builder analysis-page"
    >
      <p>{t("builderIntro")}</p>
      <AnalysisSummary />
      <p className="note">{t("builderHint")}</p>
      <p className="analysis-actions">
        <button
          type="button"
          data-testid="builder-load-preset"
          onClick={() => setConfig({ ...COL_HS64_PRESET, view: "builder", lang })}
        >
          {t("presetColHs64")}
        </button>{" "}
        <Link to={rankingTo} data-testid="builder-to-ranking">
          {t("openRanking")}
        </Link>
      </p>
    </PageShell>
  );
}
