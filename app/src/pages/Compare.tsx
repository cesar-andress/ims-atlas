import { lazy, Suspense, useMemo, useRef } from "react";
import { useTranslation } from "../i18n";
import { AnalysisPage } from "../components/AnalysisPage";
import {
  downloadChartPng,
  downloadChartSvg,
  downloadText,
} from "../cite/exportDownload";
import { useRankingModel } from "../ranking/useRankingModel";
import type { RankingViewModel } from "../ranking/rankingEngine";

const Top10Chart = lazy(() =>
  import("../components/Top10Chart").then((m) => ({ default: m.Top10Chart })),
);

type ChartHandle = { getDataURL: (opts: object) => string };

function CompareBody({ model }: { model: RankingViewModel }) {
  const { t } = useTranslation();
  const totalRef = useRef<ChartHandle | null>(null);
  const factorRef = useRef<ChartHandle | null>(null);
  const comboRef = useRef<ChartHandle | null>(null);

  const topTotal = useMemo(
    () =>
      model.ranking.slice(0, 10).map((r) => ({
        name: r.iso3,
        value: r.score,
      })),
    [model],
  );

  const factorKey = useMemo(() => {
    const keys = Object.keys(model.factorScores[model.ranking[0]?.iso3 ?? ""] ?? {});
    return keys.sort()[0] ?? "demand";
  }, [model]);

  const topFactor = useMemo(
    () =>
      [...model.ranking]
        .sort(
          (a, b) =>
            (model.factorScores[b.iso3]?.[factorKey] ?? 0) -
            (model.factorScores[a.iso3]?.[factorKey] ?? 0),
        )
        .slice(0, 10)
        .map((r) => ({
          name: r.iso3,
          value: model.factorScores[r.iso3]?.[factorKey] ?? 0,
        })),
    [model, factorKey],
  );

  const topCombo = useMemo(
    () =>
      model.ranking.slice(0, 10).map((r) => ({
        name: r.iso3,
        total: r.score,
        factor: model.factorScores[r.iso3]?.[factorKey] ?? 0,
      })),
    [model, factorKey],
  );

  function exportCsv(
    filename: string,
    rows: { name: string; value?: number; total?: number; factor?: number }[],
  ) {
    const hasCombo = rows.some((r) => r.total !== undefined);
    const lines = hasCombo
      ? ["iso3,total,factor", ...rows.map((r) => `${r.name},${r.total},${r.factor}`)]
      : ["iso3,value", ...rows.map((r) => `${r.name},${r.value}`)];
    downloadText(filename, lines.join("\n") + "\n", "text/csv");
  }

  return (
    <div className="compare-grid" data-testid="compare-charts">
      <section data-testid="compare-total">
        <h2>{t("parityTop10Total")}</h2>
        <div className="export-row">
          <button
            type="button"
            data-testid="export-total-png"
            onClick={() =>
              totalRef.current && downloadChartPng(totalRef.current, "top10-total.png")
            }
          >
            PNG
          </button>
          <button
            type="button"
            data-testid="export-total-svg"
            onClick={() =>
              totalRef.current && downloadChartSvg(totalRef.current, "top10-total.svg")
            }
          >
            SVG
          </button>
          <button
            type="button"
            data-testid="export-total-csv"
            onClick={() => exportCsv("top10-total.csv", topTotal)}
          >
            CSV
          </button>
        </div>
        <Suspense fallback={<p className="muted">{t("loading")}</p>}>
          <Top10Chart
            title={t("parityTop10Total")}
            series={topTotal}
            onReady={(c) => {
              totalRef.current = c;
            }}
          />
        </Suspense>
      </section>

      <section data-testid="compare-factor">
        <h2>
          {t("parityTop10Factor")}: {factorKey}
        </h2>
        <div className="export-row">
          <button
            type="button"
            data-testid="export-factor-png"
            onClick={() =>
              factorRef.current &&
              downloadChartPng(factorRef.current, "top10-factor.png")
            }
          >
            PNG
          </button>
          <button
            type="button"
            data-testid="export-factor-svg"
            onClick={() =>
              factorRef.current &&
              downloadChartSvg(factorRef.current, "top10-factor.svg")
            }
          >
            SVG
          </button>
          <button
            type="button"
            data-testid="export-factor-csv"
            onClick={() => exportCsv("top10-factor.csv", topFactor)}
          >
            CSV
          </button>
        </div>
        <Suspense fallback={<p className="muted">{t("loading")}</p>}>
          <Top10Chart
            title={`${t("parityTop10Factor")} (${factorKey})`}
            series={topFactor}
            onReady={(c) => {
              factorRef.current = c;
            }}
          />
        </Suspense>
      </section>

      <section data-testid="compare-combo">
        <h2>{t("parityTop10Combo")}</h2>
        <div className="export-row">
          <button
            type="button"
            data-testid="export-combo-png"
            onClick={() =>
              comboRef.current && downloadChartPng(comboRef.current, "top10-combo.png")
            }
          >
            PNG
          </button>
          <button
            type="button"
            data-testid="export-combo-svg"
            onClick={() =>
              comboRef.current && downloadChartSvg(comboRef.current, "top10-combo.svg")
            }
          >
            SVG
          </button>
          <button
            type="button"
            data-testid="export-combo-csv"
            onClick={() => exportCsv("top10-combo.csv", topCombo)}
          >
            CSV
          </button>
        </div>
        <Suspense fallback={<p className="muted">{t("loading")}</p>}>
          <Top10Chart
            title={t("parityTop10Combo")}
            series={topCombo.map((r) => ({ name: r.name, value: r.total }))}
            secondary={topCombo.map((r) => ({ name: r.name, value: r.factor }))}
            onReady={(c) => {
              comboRef.current = c;
            }}
          />
        </Suspense>
      </section>
    </div>
  );
}

export function Compare() {
  const { model, error } = useRankingModel();
  return (
    <AnalysisPage
      testId="compare-view"
      titleKey="nav.compare"
      model={model}
      error={error}
    >
      {(m) => <CompareBody model={m} />}
    </AnalysisPage>
  );
}
