import type { ReactNode } from "react";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { COL_HS64_PRESET } from "../state/schema";
import { isAnalysisReady } from "../state/views";
import { AnalysisSummary } from "./AnalysisSummary";
import { AnalysisTabs } from "./AnalysisTabs";
import { PermalinkLink } from "./PermalinkLink";
import type { RankingViewModel } from "../ranking/rankingEngine";

type Props = {
  testId: string;
  titleKey: string;
  intro?: string | undefined;
  model: RankingViewModel | null;
  error: string | null;
  /** Extra controls rendered under the context line when a model is ready. */
  controls?: ReactNode;
  children: (model: RankingViewModel) => ReactNode;
};

/**
 * Shared view shell for Ranking / Matrix / Market map:
 * title, analysis context, loading/error/empty gates, then content.
 */
export function AnalysisPage({
  testId,
  titleKey,
  intro,
  model,
  error,
  controls,
  children,
}: Props) {
  const { t, i18n } = useTranslation();
  const { config, replaceConfig } = useAnalysis();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const ready = isAnalysisReady(config);

  return (
    <section
      className="analysis-page"
      data-testid={testId}
      aria-labelledby={`${testId}-title`}
    >
      <header className="analysis-page-header">
        <h1 id={`${testId}-title`}>{t(titleKey)}</h1>
        {intro ? <p className="muted">{intro}</p> : null}
        <AnalysisTabs />
        <p className="analysis-context muted" data-testid="analysis-context">
          {config.origin ?? "—"} / HS{config.hs ?? "—"} / {config.year ?? "—"} ·{" "}
          {config.weightScheme ?? "expert_mean"} · {config.mcdm ?? "wsm"}
        </p>
      </header>

      {controls}

      {error ? (
        <div
          className={
            error.includes("DATA_RELEASE_PENDING") ||
            error.toLowerCase().includes("release pending")
              ? "analysis-empty"
              : "error"
          }
          role="alert"
          data-testid={
            error.includes("DATA_RELEASE_PENDING") ||
            error.toLowerCase().includes("release pending")
              ? "data-release-pending"
              : "analysis-error"
          }
        >
          <p>
            {error.includes("DATA_RELEASE_PENDING") ||
            error.toLowerCase().includes("release pending")
              ? t("dataReleasePending")
              : error}
          </p>
          {(error.includes("DATA_RELEASE_PENDING") ||
            error.toLowerCase().includes("release pending")) && (
            <p className="muted small">
              {error.replace(/^DATA_RELEASE_PENDING:\s*/, "")}
            </p>
          )}
        </div>
      ) : null}

      {!ready && !error ? (
        <div className="analysis-empty" data-testid="analysis-empty">
          <p>{t("analysisNeedConfig")}</p>
          <AnalysisSummary />
          <p className="analysis-actions">
            <button
              type="button"
              data-testid="analysis-load-preset"
              onClick={() =>
                replaceConfig({
                  ...COL_HS64_PRESET,
                  view: config.view,
                  lang: config.lang ?? lang,
                })
              }
            >
              {t("presetColHs64")}
            </button>{" "}
            <PermalinkLink view="builder">{t("nav.builder")}</PermalinkLink>
          </p>
        </div>
      ) : null}

      {ready && !model && !error ? (
        <p data-testid="analysis-loading">{t("loading")}</p>
      ) : null}

      {ready && model ? (
        <>
          {model.warnings.length > 0 ? (
            <ul className="warnings" data-testid="ranking-warnings">
              {model.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {children(model)}
        </>
      ) : null}
    </section>
  );
}
