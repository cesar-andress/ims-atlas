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
import { downloadChartPng, downloadChartSvg } from "../cite/exportDownload";
import { loadRankYearsFixture, type RankYearsFixture } from "../data/loadRankYears";
import { useRankingModel } from "../ranking/useRankingModel";
import type { BumpSeries } from "../components/BumpChart";
import type * as echarts from "echarts/core";

const BumpChart = lazy(() =>
  import("../components/BumpChart").then((m) => ({ default: m.BumpChart })),
);

export function TimeExplorer() {
  const { t } = useTranslation();
  const { model, error } = useRankingModel();
  const [fixture, setFixture] = useState<RankYearsFixture | null>(null);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
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
  }, []);

  const onReady = useCallback((chart: echarts.ECharts) => {
    chartRef.current = chart;
  }, []);

  const { years, series, tableRows } = useMemo(() => {
    if (!fixture || !model) {
      return {
        years: [] as number[],
        series: [] as BumpSeries[],
        tableRows: [] as string[][],
      };
    }
    const years = fixture.years;
    const focus = fixture.focus_iso3;
    const panelYear = model.panel.year;
    const liveRank = new Map(model.ranking.map((r) => [r.iso3, r.rank]));
    const rankAt = (iso3: string, y: number): number | null => {
      // Same config year must match the live ranking panel (Phase 12-fix).
      if (y === panelYear) return liveRank.get(iso3) ?? null;
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
    return { years, series, tableRows };
  }, [fixture, model]);

  return (
    <AnalysisPage
      testId="time-view"
      titleKey="nav.time"
      intro={t("timeIntro")}
      model={model}
      error={error ?? fixtureError}
      controls={
        fixture ? (
          <div className="matrix-controls" data-testid="time-controls">
            <button
              type="button"
              data-testid="export-bump-png"
              onClick={() => {
                if (chartRef.current)
                  downloadChartPng(chartRef.current, "ims-atlas-bump.png");
              }}
            >
              PNG
            </button>
            <button
              type="button"
              data-testid="export-bump-svg"
              onClick={() => {
                if (chartRef.current)
                  downloadChartSvg(chartRef.current, "ims-atlas-bump.svg");
              }}
            >
              SVG
            </button>
          </div>
        ) : null
      }
    >
      {() =>
        fixture ? (
          <div data-testid="time-body">
            <p className="muted small" data-testid="time-provenance">
              {fixture.source}
            </p>
            <Suspense fallback={<p className="muted">{t("loading")}</p>}>
              <BumpChart years={years} series={series} onReady={onReady} />
            </Suspense>
            <div className="table-scroll">
              <table data-testid="bump-table">
                <thead>
                  <tr>
                    {tableRows[0]?.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.slice(1).map((row) => (
                    <tr key={row[0]} data-iso3={row[0]}>
                      {row.map((cell, i) => (
                        <td key={`${row[0]}-${i}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="muted">{t("loading")}</p>
        )
      }
    </AnalysisPage>
  );
}
