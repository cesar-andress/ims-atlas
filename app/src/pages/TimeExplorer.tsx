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
import { ChartExportBar } from "../components/ChartExportBar";
import { loadRankYearsFixture, type RankYearsFixture } from "../data/loadRankYears";
import { analysisErrorMessage } from "../ranking/analysisError";
import { useRankingModel } from "../ranking/useRankingModelApi";
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
    if (!fixture) {
      return {
        years: [] as number[],
        series: [] as BumpSeries[],
        tableRows: [] as string[][],
      };
    }
    const years = fixture.years;
    const focus = fixture.focus_iso3;
    const panelYear = model?.panel.year;
    const liveRank = model ? new Map(model.ranking.map((r) => [r.iso3, r.rank])) : null;
    const rankAt = (iso3: string, y: number): number | null => {
      // Live panel year overlays the ranking model when available (Phase 12-fix).
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
    return { years, series, tableRows };
  }, [fixture, model]);

  const pageError = error ?? (fixtureError ? analysisErrorMessage(fixtureError) : null);

  return (
    <AnalysisPage
      testId="time-view"
      titleKey="nav.time"
      intro={t("timeIntro")}
      model={model}
      error={pageError}
      allowWithoutModel
      controls={
        fixture ? (
          <div className="matrix-controls" data-testid="time-controls">
            <ChartExportBar
              testIdPrefix="bump"
              chartRef={chartRef}
              pngName="ims-atlas-bump.png"
              svgName="ims-atlas-bump.svg"
              className="export-row"
            />
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
