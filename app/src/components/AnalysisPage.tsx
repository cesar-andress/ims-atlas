import type { ReactNode } from "react";
import { useTranslation } from "../i18n";
import type { AnalysisModelError } from "../ranking/analysisError";
import type { RankingViewModel } from "../ranking/rankingEngine";
import { useAnalysis } from "../state/useAnalysis";
import { COL_HS64_PRESET } from "../state/schema";
import { isAnalysisReady } from "../state/views";
import { AnalysisSummary } from "./AnalysisSummary";
import { HelpButton } from "./HelpButton";
import { PendingReleaseNotice } from "./PendingReleaseNotice";
import { PermalinkLink } from "./PermalinkLink";
import { ProductContextBanner } from "./ProductContextBanner";
import { methodPlainLabel } from "../design/plainLabels";

type Props = {
  testId: string;
  titleKey: string;
  intro?: string | undefined;
  model: RankingViewModel | null;
  error: AnalysisModelError | null;
  /** Extra controls under the context line. */
  controls?: ReactNode;
  /**
   * Cite / Backtest / Time: still render body when the ranking model is
   * unavailable (pending release or loading). Ranking-dependent UI should
   * branch on `model` inside children.
   */
  allowWithoutModel?: boolean;
  /**
   * `results` = GUI-0 mockup shell: no second tab row, no method-id line,
   * no page title (dashboard header owns chrome).
   */
  chrome?: "default" | "results";
  children: (model: RankingViewModel | null) => ReactNode;
};

/**
 * Shared view shell for analysis workspace pages:
 * title, tabs, context, loading/error/empty gates, then content.
 */
export function AnalysisPage({
  testId,
  titleKey,
  intro,
  model,
  error,
  controls,
  allowWithoutModel = false,
  chrome = "default",
  children,
}: Props) {
  const { t, i18n } = useTranslation();
  const { config, replaceConfig } = useAnalysis();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const ready = isAnalysisReady(config);
  const pending = error?.kind === "pending";
  const hardError = error?.kind === "error";
  const resultsChrome = chrome === "results";

  // Hard errors must not leave stale model UI (e.g. map spinner forever).
  const showModelBody = ready && Boolean(model) && !hardError;
  const showFallbackBody =
    allowWithoutModel && !hardError && (ready || pending) && !showModelBody;
  const showLoading = ready && !model && !error && !allowWithoutModel && !showModelBody;

  return (
    <section
      className={`analysis-page${resultsChrome ? " analysis-page-results" : ""}`}
      data-testid={testId}
      {...(resultsChrome
        ? { "data-chrome": "results" }
        : { "aria-labelledby": `${testId}-title` })}
    >
      {resultsChrome && !showModelBody ? (
        <div className="results-chrome-fallback" data-testid="results-chrome-shell">
          <div className="results-header-actions">
            <HelpButton />
            <PermalinkLink
              view="builder"
              className="btn btn-secondary"
              data-testid="change-analysis"
            >
              {t("changeAnalysis")}
            </PermalinkLink>
          </div>
          <ProductContextBanner />
          <p className="muted small">
            <PermalinkLink view="analisis">{t("nav.analisis")}</PermalinkLink>
            {" · "}
            <PermalinkLink view="variables">{t("changeAnalysis")}</PermalinkLink>
          </p>
        </div>
      ) : resultsChrome ? null : (
        <header className="analysis-page-header">
          <div className="analysis-title-row">
            <h1 id={`${testId}-title`}>{t(titleKey)}</h1>
            <HelpButton />
          </div>
          {intro ? <p className="muted">{intro}</p> : null}
          <p className="muted small" data-testid="analysis-tabs">
            <PermalinkLink view="analisis">{t("nav.analisis")}</PermalinkLink>
            {" · "}
            <PermalinkLink view="variables">{t("changeAnalysis")}</PermalinkLink>
          </p>
          <ProductContextBanner />
          <p className="analysis-context muted small" data-testid="analysis-context">
            {methodPlainLabel("weight", config.weightScheme ?? "expert_mean", t)}
            {" · "}
            {methodPlainLabel("mcdm", config.mcdm ?? "wsm", t)}
            {" · "}
            {methodPlainLabel("norm", config.normalization ?? "minmax", t)}
          </p>
        </header>
      )}

      {pending ? <PendingReleaseNotice detail={error.message} /> : null}

      {hardError ? (
        <div className="error" role="alert" data-testid="analysis-error">
          <p>{error.message}</p>
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
            {" · "}
            <PermalinkLink view="status">{t("nav.status")}</PermalinkLink>
          </p>
        </div>
      ) : null}

      {showLoading ? <p data-testid="analysis-loading">{t("loading")}</p> : null}

      {showModelBody || showFallbackBody ? (
        <>
          {resultsChrome ? null : controls}
          {!resultsChrome && model && model.warnings.length > 0 ? (
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
