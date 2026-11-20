import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "../i18n";
import { AnalysisPage } from "../components/AnalysisPage";
import { ChartFrame } from "../components/ChartFrame";
import { ExportMenu } from "../components/ExportMenu";
import { countryLabel } from "../design/formatLocale";
import { loadRankYearsFixture, type RankYearsFixture } from "../data/loadRankYears";
import { analysisErrorMessage } from "../ranking/analysisError";
import { isColHs64Preset } from "../ranking/demoPanel";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";
import type { BumpSeries } from "../components/BumpChart";
import type * as echarts from "echarts/core";

const BumpChart = lazy(() =>
  import("../components/BumpChart").then((m) => ({ default: m.BumpChart })),
);

function deltaClass(prev: number | null, cur: number | null): string {
  if (prev === null || cur === null) return "";
  if (cur < prev) return "bump-delta-up";
  if (cur > prev) return "bump-delta-down";
  return "bump-delta-flat";
}

function deltaLabel(prev: number | null, cur: number | null): string {
  if (prev === null || cur === null) return "";
  const d = prev - cur; // positive = improved (lower rank number)
  if (d === 0) return "=";
  return d > 0 ? `↑${d}` : `↓${Math.abs(d)}`;
}

export function TimeExplorer() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config } = useAnalysis();
  const { model, error } = useRankingModel();
  const [fixture, setFixture] = useState<RankYearsFixture | null>(null);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playYearIdx, setPlayYearIdx] = useState(0);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const paperPreset = isColHs64Preset({
    ...(config.origin !== undefined ? { origin: config.origin } : {}),
    ...(config.hs !== undefined ? { hs: config.hs } : {}),
    ...(config.year !== undefined ? { year: config.year } : {}),
  });

  useEffect(() => {
    if (!paperPreset) {
      setFixture(null);
      setFixtureError(null);
      return;
    }
    let cancelled = false;
    void loadRankYearsFixture()
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
  }, [paperPreset]);

  useEffect(() => {
    if (!playing || !fixture || fixture.years.length < 2) return;
    const id = window.setInterval(() => {
      setPlayYearIdx((i) => (i + 1) % fixture.years.length);
    }, 1200);
    return () => window.clearInterval(id);
  }, [playing, fixture]);

  const onReady = useCallback((chart: echarts.ECharts) => {
    chartRef.current = chart;
  }, []);

  const { years, series, tableRows, focus } = useMemo(() => {
    if (!fixture) {
      return {
        years: [] as number[],
        series: [] as BumpSeries[],
        tableRows: [] as string[][],
        focus: [] as string[],
      };
    }
    const years = fixture.years;
    const focus = fixture.focus_iso3;
    const panelYear = model?.panel.year;
    const liveRank = model ? new Map(model.ranking.map((r) => [r.iso3, r.rank])) : null;
    const rankAt = (iso3: string, y: number): number | null => {
      if (liveRank && panelYear !== undefined && y === panelYear) {
        return liveRank.get(iso3) ?? null;
      }
      const row = fixture.rankings[String(y)]?.find((r) => r.iso3 === iso3);
      return row?.rank ?? null;
    };
    const series: BumpSeries[] = focus.map((iso3) => ({
      iso3,
      ranks: years.map((y) => rankAt(iso3, y)),
    }));
    const header = ["iso3", ...years.map(String)];
    const tableRows = [
      header,
      ...focus.map((iso3) => [
        iso3,
        ...years.map((y) => {
          const r = rankAt(iso3, y);
          return r === null ? "" : String(r);
        }),
      ]),
    ];
    return { years, series, tableRows, focus };
  }, [fixture, model]);

  const playYear = years.length > 0 ? years[playYearIdx % years.length]! : null;

  const pageError = error ?? (fixtureError ? analysisErrorMessage(fixtureError) : null);
  const chartTitle = t("bumpChartTitle");

  return (
    <AnalysisPage
      testId="time-view"
      titleKey="nav.time"
      intro={t("timeIntro")}
      model={model}
      error={pageError}
      allowWithoutModel
      chrome="results"
    >
      {() =>
        !paperPreset ? (
          <p className="muted small" data-testid="time-other-product">
            {t("timeOtherProduct")}
          </p>
        ) : fixture ? (
          <div className="time-explorer" data-testid="time-body">
            <p className="muted small" data-testid="time-provenance">
              {fixture.source}
            </p>

            {years.length > 1 ? (
              <div className="year-play" data-testid="time-year-play">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-testid="time-year-toggle"
                  onClick={() => setPlaying((p) => !p)}
                >
                  {playing ? t("hopPause") : t("yearPlay")}
                </button>
                <span className="muted small font-tabular" data-testid="time-play-year">
                  {playYear}
                </span>
                <span className="muted small">{t("yearPlayHint")}</span>
              </div>
            ) : null}

            <section className="results-card" data-export-surface="chart">
              <ChartFrame
                testIdPrefix="bump"
                title={chartTitle}
                chartRef={chartRef}
                sourceLine={fixture.source}
                showOnScreenCredit
              >
                <Suspense fallback={<p className="muted">{t("loading")}</p>}>
                  <BumpChart
                    years={years}
                    series={series}
                    highlightYear={playYear}
                    onReady={onReady}
                  />
                </Suspense>
              </ChartFrame>
            </section>

            <section
              className="results-card bump-table-card"
              data-testid="bump-table-card"
            >
              <div className="bump-table-head">
                <h2>{t("bumpTableTitle")}</h2>
                <ExportMenu
                  testIdPrefix="bump-table"
                  kind="table"
                  title={chartTitle}
                  sourceLine={fixture.source}
                  tableRows={tableRows}
                  csvFilename="ims-atlas-bump-ranks.csv"
                  xlsxFilename="ims-atlas-bump-ranks.xlsx"
                />
              </div>
              <p className="muted small bump-table-hint">{t("bumpTableHint")}</p>
              <div className="table-scroll bump-table-scroll">
                <table className="bump-table" data-testid="bump-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("bumpColMarket")}</th>
                      {years.map((y) => (
                        <th
                          key={y}
                          scope="col"
                          className={
                            playYear === y
                              ? "bump-year-active font-tabular"
                              : "font-tabular"
                          }
                        >
                          {y}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {focus.map((iso3, rowIdx) => {
                      const ranks = series[rowIdx]?.ranks ?? [];
                      return (
                        <tr key={iso3} data-iso3={iso3}>
                          <th scope="row">
                            <span className="iso-chip">{iso3}</span>
                            <span className="bump-market-name">
                              {countryLabel(iso3, lang)}
                            </span>
                          </th>
                          {ranks.map((rank, i) => {
                            const y = years[i]!;
                            const prev = i > 0 ? (ranks[i - 1] ?? null) : null;
                            const active = playYear === y;
                            return (
                              <td
                                key={`${iso3}-${y}`}
                                className={[
                                  "font-tabular",
                                  active ? "bump-year-active" : "",
                                  deltaClass(prev, rank),
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <span className="bump-rank">
                                  {rank === null ? "—" : rank}
                                </span>
                                {i > 0 && rank !== null && prev !== null ? (
                                  <span className="bump-delta" aria-hidden>
                                    {deltaLabel(prev, rank)}
                                  </span>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <p className="muted">{t("loading")}</p>
        )
      }
    </AnalysisPage>
  );
}
