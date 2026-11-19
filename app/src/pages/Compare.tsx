import { lazy, Suspense, useMemo, useRef } from "react";
import { AnalysisPage } from "../components/AnalysisPage";
import { ChartExportBar } from "../components/ChartExportBar";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModel";
import type { RankingViewModel } from "../ranking/rankingEngine";

const Top10Chart = lazy(() =>
  import("../components/Top10Chart").then((m) => ({ default: m.Top10Chart })),
);

type ChartHandle = { getDataURL: (opts: object) => string };

type SeriesRow = { name: string; value: number };
type ComboRow = { name: string; total: number; factor: number };

function csvBody(rows: SeriesRow[] | ComboRow[], mode: "value" | "combo"): string {
  if (mode === "combo") {
    const combo = rows as ComboRow[];
    return (
      [
        "iso3,total,factor",
        ...combo.map((r) => `${r.name},${r.total},${r.factor}`),
      ].join("\n") + "\n"
    );
  }
  const simple = rows as SeriesRow[];
  return ["iso3,value", ...simple.map((r) => `${r.name},${r.value}`)].join("\n") + "\n";
}

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

  return (
    <div className="compare-grid" data-testid="compare-charts">
      <section data-testid="compare-total">
        <h2>{t("parityTop10Total")}</h2>
        <ChartExportBar
          testIdPrefix="total"
          chartRef={totalRef}
          pngName="top10-total.png"
          svgName="top10-total.svg"
          csv={{ filename: "top10-total.csv", body: csvBody(topTotal, "value") }}
        />
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
        <ChartExportBar
          testIdPrefix="factor"
          chartRef={factorRef}
          pngName="top10-factor.png"
          svgName="top10-factor.svg"
          csv={{ filename: "top10-factor.csv", body: csvBody(topFactor, "value") }}
        />
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
        <ChartExportBar
          testIdPrefix="combo"
          chartRef={comboRef}
          pngName="top10-combo.png"
          svgName="top10-combo.svg"
          csv={{ filename: "top10-combo.csv", body: csvBody(topCombo, "combo") }}
        />
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
      {(m) => (m ? <CompareBody model={m} /> : null)}
    </AnalysisPage>
  );
}
