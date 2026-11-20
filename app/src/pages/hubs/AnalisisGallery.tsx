import { useEffect, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import { useTranslation } from "../../i18n";
import { IMSFE_BAENA_CANO_PRESET } from "../../state/schema";
import { useAnalysis } from "../../state/useAnalysis";
import { isAnalysisReady } from "../../state/views";
import type { ViewId } from "../../state/schema";

type Study = {
  id: string;
  view: ViewId;
  titleKey: string;
  bodyKey: string;
  paperOnly?: boolean;
};

const STUDIES: Study[] = [
  {
    id: "ranking",
    view: "ranking",
    titleKey: "studyRanking",
    bodyKey: "studyRankingBody",
  },
  {
    id: "matrix",
    view: "matrix",
    titleKey: "studyMatrix",
    bodyKey: "studyMatrixBody",
  },
  { id: "map", view: "map", titleKey: "studyMap", bodyKey: "studyMapBody" },
  {
    id: "compare",
    view: "compare",
    titleKey: "studyCompare",
    bodyKey: "studyCompareBody",
  },
  { id: "time", view: "time", titleKey: "studyTime", bodyKey: "studyTimeBody" },
  {
    id: "uncertainty",
    view: "uncertainty",
    titleKey: "studyUncertainty",
    bodyKey: "studyUncertaintyBody",
  },
  {
    id: "backtest",
    view: "backtest",
    titleKey: "studyBacktest",
    bodyKey: "studyBacktestBody",
    paperOnly: true,
  },
  {
    id: "combined",
    view: "factors",
    titleKey: "studyCombined",
    bodyKey: "studyCombinedBody",
  },
  {
    id: "vos",
    view: "map",
    titleKey: "studyVos",
    bodyKey: "studyVosBody",
  },
  {
    id: "corr",
    view: "explore_analysis",
    titleKey: "studyCorr",
    bodyKey: "studyCorrBody",
  },
  { id: "cite", view: "cite", titleKey: "studyCite", bodyKey: "studyCiteBody" },
];

const EXAMPLE_NOTICE_KEY = "ims-atlas-analisis-example-notice";

function availability(
  study: Study,
  ready: boolean,
  origin: string | undefined,
  hs: string | undefined,
  year: number | undefined,
): { ok: boolean; reasonKey?: string } {
  if (!ready) return { ok: false, reasonKey: "studyNeedSelection" };
  if (study.paperOnly) {
    const paper =
      (origin ?? "").toUpperCase() === "COL" && hs === "64" && year === 2023;
    if (!paper) return { ok: false, reasonKey: "studyBacktestPaperOnly" };
  }
  return { ok: true };
}

/** Análisis — gallery of studies for the current selection. */
export function AnalisisGallery() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const ready = isAnalysisReady(config);
  const [showExampleNotice, setShowExampleNotice] = useState(false);

  // R2: first visitor sees Jose's COL·HS64 example instead of empty "— · HS — · —".
  useEffect(() => {
    if (isAnalysisReady(config)) return;
    setConfig({
      ...IMSFE_BAENA_CANO_PRESET,
      view: "analisis",
    });
    try {
      if (sessionStorage.getItem(EXAMPLE_NOTICE_KEY) !== "0") {
        setShowExampleNotice(true);
      }
    } catch {
      setShowExampleNotice(true);
    }
    // Only on first empty visit to this gallery.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once when empty
  }, []);

  function dismissExample() {
    setShowExampleNotice(false);
    try {
      sessionStorage.setItem(EXAMPLE_NOTICE_KEY, "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <PageShell testId="analisis-gallery" titleKey="nav.analisis">
      <p className="muted">{t("hubAnalisisIntro")}</p>
      {showExampleNotice ? (
        <p className="callout" role="status" data-testid="analisis-example-notice">
          {t("analisisExampleNotice")}{" "}
          <PermalinkLink view="variables">{t("changeAnalysis")}</PermalinkLink>
          {" · "}
          <button type="button" className="btn btn-secondary" onClick={dismissExample}>
            {t("dismiss")}
          </button>
        </p>
      ) : null}
      <p className="note small" data-testid="analisis-context">
        {config.origin ?? "—"} · HS {config.hs ?? "—"} · {config.year ?? "—"}
        {" · "}
        <PermalinkLink view="variables">{t("changeAnalysis")}</PermalinkLink>
      </p>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {STUDIES.map((study) => {
          const avail = availability(
            study,
            ready,
            config.origin,
            config.hs,
            config.year,
          );
          return (
            <div
              key={study.id}
              className={`rounded-card border border-border bg-surface p-4 ${
                avail.ok ? "" : "opacity-70"
              }`}
              data-testid={`study-card-${study.id}`}
              data-available={avail.ok ? "1" : "0"}
            >
              <div
                className="mb-3 flex h-24 items-center justify-center rounded-btn bg-ground text-3xl text-ink-3"
                aria-hidden
              >
                ▦
              </div>
              <h2 className="m-0 text-base font-semibold text-ink">
                {t(study.titleKey)}
              </h2>
              <p className="m-0 mt-1 text-sm text-ink-2">{t(study.bodyKey)}</p>
              {avail.ok ? (
                <PermalinkLink
                  view={study.view}
                  className="btn btn-primary mt-3 inline-flex"
                  data-testid={`study-open-${study.id}`}
                >
                  {t("studyOpen")}
                </PermalinkLink>
              ) : (
                <p
                  className="m-0 mt-3 text-xs text-ink-3"
                  data-testid={`study-blocked-${study.id}`}
                >
                  {t(avail.reasonKey ?? "studyNeedSelection")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
