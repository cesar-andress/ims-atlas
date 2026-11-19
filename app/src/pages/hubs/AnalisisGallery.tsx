import { PageShell } from "../../components/PageShell";
import { PermalinkLink } from "../../components/PermalinkLink";
import { useTranslation } from "../../i18n";
import { useAnalysis } from "../../state/useAnalysis";
import { isAnalysisReady } from "../../state/views";
import type { ViewId } from "../../state/schema";

type Study = {
  view: ViewId;
  titleKey: string;
  bodyKey: string;
  needsYears?: number;
  needsEoc?: boolean;
  paperOnly?: boolean;
};

const STUDIES: Study[] = [
  { view: "ranking", titleKey: "studyRanking", bodyKey: "studyRankingBody" },
  {
    view: "matrix",
    titleKey: "studyMatrix",
    bodyKey: "studyMatrixBody",
    needsEoc: true,
  },
  { view: "map", titleKey: "studyMap", bodyKey: "studyMapBody" },
  { view: "compare", titleKey: "studyCompare", bodyKey: "studyCompareBody" },
  { view: "time", titleKey: "studyTime", bodyKey: "studyTimeBody", needsYears: 3 },
  {
    view: "uncertainty",
    titleKey: "studyUncertainty",
    bodyKey: "studyUncertaintyBody",
  },
  {
    view: "backtest",
    titleKey: "studyBacktest",
    bodyKey: "studyBacktestBody",
    paperOnly: true,
  },
  { view: "factors", titleKey: "studyFactors", bodyKey: "studyFactorsBody" },
  { view: "cite", titleKey: "studyCite", bodyKey: "studyCiteBody" },
];

function availability(
  study: Study,
  ready: boolean,
  origin: string | undefined,
  hs: string | undefined,
): { ok: boolean; reasonKey?: string } {
  if (!ready) return { ok: false, reasonKey: "studyNeedSelection" };
  if (study.paperOnly) {
    const paper =
      (origin ?? "").toUpperCase() === "COL" && (hs === "64" || hs === "6401");
    // Honest gate: backtest release is paper COL·HS64; HS 6401 selection must not show mismatched numbers.
    if ((origin ?? "").toUpperCase() === "COL" && hs === "6401") {
      return { ok: false, reasonKey: "studyBacktestPaperOnly" };
    }
    if (!paper && study.view === "backtest") {
      return { ok: false, reasonKey: "studyBacktestPaperOnly" };
    }
  }
  return { ok: true };
}

/** Análisis — gallery of studies for the current selection. */
export function AnalisisGallery() {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const ready = isAnalysisReady(config);

  return (
    <PageShell testId="analisis-gallery" titleKey="nav.analisis">
      <p className="muted">{t("hubAnalisisIntro")}</p>
      <p className="note small" data-testid="analisis-context">
        {config.origin ?? "—"} · HS {config.hs ?? "—"} · {config.year ?? "—"}
        {" · "}
        <PermalinkLink view="builder">{t("changeAnalysis")}</PermalinkLink>
      </p>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {STUDIES.map((study) => {
          const avail = availability(study, ready, config.origin, config.hs);
          return (
            <div
              key={study.view}
              className={`rounded-card border border-border bg-surface p-4 ${
                avail.ok ? "" : "opacity-70"
              }`}
              data-testid={`study-card-${study.view}`}
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
                  data-testid={`study-open-${study.view}`}
                >
                  {t("studyOpen")}
                </PermalinkLink>
              ) : (
                <p
                  className="m-0 mt-3 text-xs text-ink-3"
                  data-testid={`study-blocked-${study.view}`}
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
