import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { AnalysisPage } from "../components/AnalysisPage";
import { ChartFrame } from "../components/ChartFrame";
import { ExportMenu } from "../components/ExportMenu";
import { PermalinkLink } from "../components/PermalinkLink";
import { formatScore } from "../format";
import { loadT4Fixture, type T4Fixture } from "../data/loadT4Fixture";
import { analysisErrorMessage } from "../ranking/analysisError";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { isColHs64Preset } from "../ranking/demoPanel";
import { useAnalysis } from "../state/useAnalysis";
import { scoreBlock, spearmanCorr } from "@ims-atlas/core";

const Top10Chart = lazy(() =>
  import("../components/Top10Chart").then((m) => ({ default: m.Top10Chart })),
);

type BacktestTarget = "intensive" | "new_markets" | "growth";
type ChartHandle = { getDataURL: (opts: object) => string };

function leaveOneOutSpearman(
  model: NonNullable<ReturnType<typeof useRankingModel>["model"]>,
) {
  const baseRanks = new Map(model.ranking.map((r) => [r.iso3, r.rank]));
  const rows: { variable: string; spearman: number }[] = [];
  for (const drop of model.prepared.usedVariables) {
    const keep = model.prepared.usedVariables.filter((id) => id !== drop);
    if (keep.length < 2) continue;
    const colIdx = keep.map((id) =>
      model.panel.variables.findIndex((v) => v.id === id),
    );
    const variables = keep.map((id, i) => model.panel.variables[colIdx[i]!]!);
    const values = model.prepared.candidates.map((iso) => {
      const rowIdx = model.panel.candidates.indexOf(iso);
      const row = model.panel.values[rowIdx]!;
      return colIdx.map((j) => row[j]!);
    });
    const result = scoreBlock({
      candidates: model.prepared.candidates,
      variables,
      values,
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "expert_mean",
      policy: { maxMissingShare: 0.2, minCandidates: 20 },
    });
    const a: Record<string, number> = {};
    const b: Record<string, number> = {};
    for (const r of result.ranking) {
      a[r.iso3] = r.rank;
      b[r.iso3] = baseRanks.get(r.iso3)!;
    }
    rows.push({ variable: drop, spearman: spearmanCorr(a, b) });
  }
  rows.sort((x, y) => x.spearman - y.spearman);
  return rows;
}

function methodDisplay(method: string, lang: "es" | "en"): string {
  if (method.startsWith("wsm|")) {
    return lang === "es" ? "IMSFE (suma ponderada)" : "IMSFE (weighted sum)";
  }
  if (method === "import_volume") {
    return lang === "es" ? "Volumen de importación" : "Import volume";
  }
  if (method === "gravity_ppml") {
    return lang === "es" ? "Gravedad PPML" : "Gravity PPML";
  }
  if (method === "random") {
    return lang === "es" ? "Aleatorio" : "Random";
  }
  return method;
}

function targetDisplay(target: BacktestTarget, lang: "es" | "en"): string {
  if (target === "intensive") return lang === "es" ? "Intensivo" : "Intensive";
  if (target === "new_markets")
    return lang === "es" ? "Mercados nuevos" : "New markets";
  return lang === "es" ? "Crecimiento" : "Growth";
}

function deltaTone(value: number): "pos" | "neg" | "flat" {
  if (value > 0.0005) return "pos";
  if (value < -0.0005) return "neg";
  return "flat";
}

function formatDelta(value: number): string {
  const s = formatScore(value);
  return value > 0 ? `+${s}` : s;
}

export function Backtest() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config } = useAnalysis();
  const { model, error } = useRankingModel();
  const [fixture, setFixture] = useState<T4Fixture | null>(null);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const chartRef = useRef<ChartHandle | null>(null);
  const target: BacktestTarget = config.backtestTarget ?? "intensive";
  const horizon = config.backtestHorizon === 3 ? 3 : 1;

  useEffect(() => {
    let cancelled = false;
    void loadT4Fixture()
      .then((f) => {
        if (!cancelled) setFixture(f);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFixtureError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metricRows = useMemo(() => {
    if (!fixture) return [];
    return fixture.metrics.filter(
      (r) =>
        r.metric === "ndcg@10" &&
        r.target === target &&
        r.horizon === horizon &&
        (r.method === fixture.focal_method ||
          r.method === "import_volume" ||
          r.method === "gravity_ppml" ||
          r.method === "random"),
    );
  }, [fixture, target, horizon]);

  const liftRows = useMemo(() => {
    if (!fixture) return [];
    return fixture.paired_lift.filter(
      (r) => r.target === target && r.horizon === horizon,
    );
  }, [fixture, target, horizon]);

  const focalNdgc = metricRows.find((r) => r.method === fixture?.focal_method);

  const sortedMetrics = useMemo(
    () => [...metricRows].sort((a, b) => b.mean - a.mean),
    [metricRows],
  );

  const chartSeries = useMemo(
    () =>
      sortedMetrics.map((r) => ({
        name: methodDisplay(r.method, lang).split(" (")[0] ?? r.method,
        value: r.mean,
      })),
    [sortedMetrics, lang],
  );

  const loo = useMemo(() => (model ? leaveOneOutSpearman(model) : []), [model]);
  const looMin = loo.length ? Math.min(...loo.map((r) => r.spearman)) : 0;
  const looMax = loo.length ? Math.max(...loo.map((r) => r.spearman)) : 1;

  const colRow = fixture?.col_hs64.find((r) => r.horizon_k === horizon);
  const paperPreset = isColHs64Preset({
    ...(config.origin !== undefined ? { origin: config.origin } : {}),
    ...(config.hs !== undefined ? { hs: config.hs } : {}),
    ...(config.year !== undefined ? { year: config.year } : {}),
  });

  return (
    <AnalysisPage
      testId="backtest-view"
      titleKey="nav.backtest"
      intro={t("backtestIntro")}
      model={model}
      error={error ?? (fixtureError ? analysisErrorMessage(fixtureError) : null)}
      allowWithoutModel
      chrome="results"
    >
      {() =>
        !paperPreset ? (
          <div className="backtest-pro" data-testid="backtest-blocked">
            <div className="backtest-empty results-card">
              <p className="note" role="status">
                {t("studyBacktestPaperOnly")}
              </p>
              <p className="muted small">
                <PermalinkLink view="variables">{t("changeAnalysis")}</PermalinkLink>
                {" · "}
                <PermalinkLink view="analisis">{t("nav.analisis")}</PermalinkLink>
              </p>
            </div>
          </div>
        ) : fixture ? (
          <div className="backtest-pro" data-testid="backtest-body">
            <header className="backtest-hero results-card">
              <div className="backtest-hero-top">
                <div>
                  <p className="backtest-kicker">{t("nav.backtest")}</p>
                  <h2 className="backtest-hero-title">
                    {lang === "es"
                      ? "Acuerdo predictivo walk-forward"
                      : "Walk-forward predictive agreement"}
                  </h2>
                </div>
                <div className="backtest-chips" data-testid="backtest-context">
                  <span className="backtest-chip">
                    <span className="backtest-chip-label">{t("backtestTarget")}</span>
                    {targetDisplay(target, lang)}
                  </span>
                  <span className="backtest-chip">
                    <span className="backtest-chip-label">{t("backtestHorizon")}</span>
                    k={horizon}
                  </span>
                  <PermalinkLink view="variables" className="backtest-chip-link">
                    {t("changeAnalysis")}
                  </PermalinkLink>
                </div>
              </div>

              <p
                className="backtest-disclaimer"
                data-testid="backtest-disclaimer"
                role="note"
              >
                {t("backtestDisclaimer")}
              </p>

              {focalNdgc ? (
                <div className="backtest-kpi-grid" data-testid="focal-ndcg">
                  <article className="backtest-kpi backtest-kpi-primary">
                    <p className="backtest-kpi-label">
                      {lang === "es"
                        ? "Método focal · NDCG@10"
                        : "Focal method · NDCG@10"}
                    </p>
                    <p className="backtest-kpi-value font-tabular">
                      <span
                        data-testid="focal-ndcg-mean"
                        data-mean={String(focalNdgc.mean)}
                      >
                        {formatScore(focalNdgc.mean)}
                      </span>
                    </p>
                    <p className="backtest-kpi-meta muted small">
                      IC 95%: [{formatScore(focalNdgc.ci95_low)},{" "}
                      {formatScore(focalNdgc.ci95_high)}] · n={focalNdgc.n_blocks}
                    </p>
                    <p className="backtest-kpi-method muted small">
                      {methodDisplay(fixture.focal_method, lang)}
                    </p>
                  </article>
                  {colRow ? (
                    <article className="backtest-kpi" data-testid="col-hs64-ndcg">
                      <p className="backtest-kpi-label">COL · HS 64</p>
                      <p className="backtest-kpi-value font-tabular">
                        <span data-mean={String(colRow.mean_ndcg_at_10)}>
                          {formatScore(colRow.mean_ndcg_at_10)}
                        </span>
                      </p>
                      <p className="backtest-kpi-meta muted small">
                        {lang === "es" ? "Horizonte" : "Horizon"} {colRow.horizon_k} ·
                        n=
                        {colRow.n_blocks} · A1
                      </p>
                    </article>
                  ) : null}
                  <article className="backtest-kpi">
                    <p className="backtest-kpi-label">
                      {lang === "es" ? "Métodos en tabla" : "Methods in table"}
                    </p>
                    <p className="backtest-kpi-value font-tabular">
                      {metricRows.length}
                    </p>
                    <p className="backtest-kpi-meta muted small">
                      {lang === "es"
                        ? "Focal + tres baselines del paper"
                        : "Focal + three paper baselines"}
                    </p>
                  </article>
                </div>
              ) : null}

              <p
                className="backtest-provenance muted small"
                data-testid="backtest-provenance"
              >
                {fixture.provenance}
              </p>
            </header>

            <section
              className="results-card backtest-panel"
              data-export-surface="chart"
            >
              <ChartFrame
                testIdPrefix="backtest-ndcg"
                title={t("ndcgByMethod")}
                chartRef={chartRef}
                showOnScreenCredit
                sourceLine={fixture.provenance}
              >
                <Suspense fallback={<p className="muted">{t("loading")}</p>}>
                  <Top10Chart
                    title={t("ndcgByMethod")}
                    series={chartSeries}
                    onReady={(c) => {
                      chartRef.current = c;
                    }}
                  />
                </Suspense>
              </ChartFrame>
            </section>

            <section
              className="results-card backtest-panel"
              data-export-surface="table"
            >
              <div className="backtest-panel-head">
                <div>
                  <h2>{t("ndcgByMethod")}</h2>
                  <p className="muted small">{t("backtestTableNdcgHint")}</p>
                </div>
                <ExportMenu
                  testIdPrefix="t4-metrics"
                  kind="table"
                  title="T4 NDCG@10 metrics"
                  tableRows={[
                    ["method", "ndcg10", "ci_low", "ci_high", "n"],
                    ...metricRows.map((r) => [
                      r.method,
                      String(r.mean),
                      String(r.ci95_low),
                      String(r.ci95_high),
                      String(r.n_blocks),
                    ]),
                  ]}
                />
              </div>
              <div className="backtest-table-wrap">
                <table className="backtest-table" data-testid="t4-metrics-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("backtestColMethod")}</th>
                      <th scope="col">NDCG@10</th>
                      <th scope="col">{t("backtestColCi")}</th>
                      <th scope="col">n</th>
                      <th scope="col" className="backtest-col-bar">
                        {lang === "es" ? "Relativo" : "Relative"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMetrics.map((r) => {
                      const focal = r.method === fixture.focal_method;
                      const max = sortedMetrics[0]?.mean || 1;
                      const pct = Math.max(8, (r.mean / max) * 100);
                      return (
                        <tr
                          key={r.method}
                          data-method={r.method}
                          className={focal ? "backtest-row-focal" : undefined}
                        >
                          <th scope="row">
                            <span className="backtest-method-name">
                              {methodDisplay(r.method, lang)}
                            </span>
                            {focal ? (
                              <span className="backtest-badge">
                                {lang === "es" ? "Focal" : "Focal"}
                              </span>
                            ) : null}
                            <span className="backtest-method-id muted">{r.method}</span>
                          </th>
                          <td
                            data-mean={String(r.mean)}
                            className="font-tabular backtest-num"
                          >
                            {formatScore(r.mean)}
                          </td>
                          <td className="font-tabular muted">
                            {formatScore(r.ci95_low)} – {formatScore(r.ci95_high)}
                          </td>
                          <td className="font-tabular">{r.n_blocks}</td>
                          <td className="backtest-col-bar">
                            <span className="backtest-inline-bar" aria-hidden>
                              <span style={{ width: `${pct}%` }} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="results-card backtest-panel"
              data-export-surface="table"
            >
              <div className="backtest-panel-head">
                <div>
                  <h2>{t("pairedLift")}</h2>
                  <p className="muted small">{t("backtestTableLiftHint")}</p>
                </div>
                <ExportMenu
                  testIdPrefix="t4-lift"
                  kind="table"
                  title="T4 paired lift"
                  tableRows={[
                    ["baseline", "delta_mean", "ci_low", "ci_high"],
                    ...liftRows.map((r) => [
                      r.baseline,
                      String(r.delta_mean),
                      String(r.ci95_low),
                      String(r.ci95_high),
                    ]),
                  ]}
                />
              </div>
              <div className="backtest-table-wrap">
                <table className="backtest-table" data-testid="t4-lift-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("backtestColBaseline")}</th>
                      <th scope="col">Δ {lang === "es" ? "media" : "mean"}</th>
                      <th scope="col">{t("backtestColCi")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liftRows.map((r) => {
                      const tone = deltaTone(r.delta_mean);
                      return (
                        <tr key={r.baseline} data-baseline={r.baseline}>
                          <th scope="row">{methodDisplay(r.baseline, lang)}</th>
                          <td
                            data-delta={String(r.delta_mean)}
                            className={`font-tabular backtest-delta backtest-delta-${tone}`}
                          >
                            {formatDelta(r.delta_mean)}
                          </td>
                          <td className="font-tabular muted">
                            {formatScore(r.ci95_low)} – {formatScore(r.ci95_high)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="results-card backtest-panel"
              data-export-surface="table"
            >
              <div className="backtest-panel-head">
                <div>
                  <h2>{t("variableValue")}</h2>
                  <p className="muted small">{t("variableValueHint")}</p>
                </div>
                <ExportMenu
                  testIdPrefix="t6-ablation"
                  kind="table"
                  title="T6 ablation"
                  tableRows={[
                    ["contrast", "delta_ndcg10", "ci_low", "ci_high"],
                    ...fixture.ablation.map((r) => [
                      r.contrast,
                      String(r.delta_mean),
                      String(r.ci95_low),
                      String(r.ci95_high),
                    ]),
                  ]}
                />
              </div>
              <div className="backtest-table-wrap">
                <table className="backtest-table" data-testid="t6-ablation-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("backtestColContrast")}</th>
                      <th scope="col">Δ NDCG@10</th>
                      <th scope="col">{t("backtestColCi")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixture.ablation.map((r) => {
                      const tone = deltaTone(r.delta_mean);
                      return (
                        <tr key={r.contrast} data-contrast={r.contrast}>
                          <th scope="row">
                            <code className="backtest-code">{r.contrast}</code>
                          </th>
                          <td
                            data-delta={String(r.delta_mean)}
                            className={`font-tabular backtest-delta backtest-delta-${tone}`}
                          >
                            {formatDelta(r.delta_mean)}
                          </td>
                          <td className="font-tabular muted">
                            {formatScore(r.ci95_low)} – {formatScore(r.ci95_high)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="results-card backtest-panel"
              data-export-surface="table"
            >
              <div className="backtest-panel-head">
                <div>
                  <h2>{t("looRankSensitivity")}</h2>
                  <p className="muted small">{t("looHint")}</p>
                </div>
                {model ? (
                  <ExportMenu
                    testIdPrefix="loo"
                    kind="table"
                    title="Leave-one-out Spearman"
                    tableRows={[
                      ["variable_dropped", "spearman"],
                      ...loo.map((r) => [r.variable, String(r.spearman)]),
                    ]}
                  />
                ) : null}
              </div>
              {model ? (
                <div className="backtest-table-wrap">
                  <table className="backtest-table" data-testid="loo-table">
                    <thead>
                      <tr>
                        <th scope="col">{t("backtestColVariable")}</th>
                        <th scope="col">Spearman</th>
                        <th scope="col" className="backtest-col-bar">
                          {lang === "es" ? "Estabilidad" : "Stability"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loo.map((r) => {
                        const span = Math.max(1e-9, looMax - looMin);
                        const pct = Math.max(6, ((r.spearman - looMin) / span) * 100);
                        return (
                          <tr key={r.variable} data-variable={r.variable}>
                            <th scope="row">
                              <code className="backtest-code">{r.variable}</code>
                            </th>
                            <td className="font-tabular backtest-num">
                              {formatScore(r.spearman)}
                            </td>
                            <td className="backtest-col-bar">
                              <span
                                className="backtest-inline-bar backtest-bar-loo"
                                aria-hidden
                              >
                                <span style={{ width: `${pct}%` }} />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted small" data-testid="loo-unavailable">
                  {t("dataReleasePending")}
                </p>
              )}
            </section>
          </div>
        ) : (
          <p className="muted">{t("loading")}</p>
        )
      }
    </AnalysisPage>
  );
}
