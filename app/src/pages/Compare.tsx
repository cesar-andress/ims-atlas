import { lazy, Suspense, useMemo, useRef, useState } from "react";
import {
  CRITERIA_TREE_PRESETS,
  combinedRankGrid,
  compareExportTables,
  compareProjects,
} from "@ims-atlas/core";
import { AnalysisPage } from "../components/AnalysisPage";
import { ChartFrame } from "../components/ChartFrame";
import { MarketRadarCompare } from "../components/MarketRadarCompare";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import type { RankingViewModel } from "../ranking/rankingEngine";
import { useAnalysis } from "../state/useAnalysis";

const Top10Chart = lazy(() =>
  import("../components/Top10Chart").then((m) => ({ default: m.Top10Chart })),
);

type ChartHandle = { getDataURL: (opts: object) => string };

function CombinedSplitTable({ model }: { model: RankingViewModel }) {
  const { t } = useTranslation();
  const grid = useMemo(() => {
    const eocIdx = model.panel.variables.findIndex((v) => v.id === "EOC");
    if (eocIdx < 0) return null;
    const imsfe: Record<string, number> = {};
    const eoc: Record<string, number> = {};
    for (const r of model.ranking) {
      imsfe[r.iso3] = r.score;
      const idx = model.panel.candidates.indexOf(r.iso3);
      if (idx < 0) continue;
      const v = model.panel.values[idx]?.[eocIdx];
      if (typeof v === "number" && Number.isFinite(v)) eoc[r.iso3] = v;
    }
    if (Object.keys(eoc).length < 5) return null;
    return combinedRankGrid(imsfe, eoc);
  }, [model]);
  if (!grid) return null;
  return (
    <div className="combined-split" data-testid="combined-rank-grid">
      <h3 className="compare-subhead">{t("combinedSplitHeading")}</h3>
      <p className="muted small">{t("combinedSplitHint")}</p>
      <div className="table-scroll">
        <table className="combined-split-table">
          <thead>
            <tr>
              <th scope="col">{t("combinedSplitRatio")}</th>
              <th scope="col">{t("combinedSplitTop")}</th>
            </tr>
          </thead>
          <tbody>
            {grid.grid.map((row) => (
              <tr key={row.a}>
                <td className="font-tabular">
                  {(row.a * 100).toFixed(0)}/{(row.b * 100).toFixed(0)}
                </td>
                <td className="font-tabular combined-split-isos">
                  {row.top10.slice(0, 5).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareBody({ model }: { model: RankingViewModel }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config } = useAnalysis();
  const [radarPicks, setRadarPicks] = useState<string[]>(() =>
    model.ranking.slice(0, 2).map((r) => r.iso3),
  );
  const totalRef = useRef<ChartHandle | null>(null);
  const factorRef = useRef<ChartHandle | null>(null);
  const comboRef = useRef<ChartHandle | null>(null);

  const familyCompare = useMemo(() => {
    const fw = CRITERIA_TREE_PRESETS.imsfe_2025_footwear;
    const oil = CRITERIA_TREE_PRESETS.imsfem_2025_olive;
    const scores = Object.fromEntries(model.ranking.map((r) => [r.iso3, r.score]));
    return compareProjects([
      {
        id: "footwear",
        label: fw.labelEs,
        nCriteria: Object.keys(fw.structure).length,
        criterionWeights: fw.criterionWeights,
        variableIds: Object.values(fw.structure).flat(),
        topMarkets: model.ranking.slice(0, 5).map((r) => r.iso3),
        methodNotes: ["IMSFE 2025 calzado 6×3"],
        scores,
      },
      {
        id: "olive",
        label: oil.labelEs,
        nCriteria: Object.keys(oil.structure).length,
        criterionWeights: oil.criterionWeights,
        variableIds: Object.values(oil.structure).flat(),
        topMarkets: model.ranking.slice(0, 5).map((r) => r.iso3),
        methodNotes: ["IMSFEM 2025 aceite 7×3 + SUST"],
        scores,
      },
    ]);
  }, [model]);

  const [projA, projB] = familyCompare.projects;
  const onlyA = (projA?.variableIds ?? []).filter(
    (v) => !(projB?.variableIds ?? []).includes(v),
  );
  const onlyB = (projB?.variableIds ?? []).filter(
    (v) => !(projA?.variableIds ?? []).includes(v),
  );

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

  const eocPct = Math.round((config.combinedEocWeight ?? 0.5) * 100);
  const imsfePct = 100 - eocPct;

  return (
    <div className="compare-grid" data-testid="compare-charts">
      <section className="results-card" data-testid="market-radar-section">
        <h2>{t("nav.compare")}</h2>
        <MarketRadarCompare
          model={model}
          selected={radarPicks}
          onToggle={(iso) =>
            setRadarPicks((prev) =>
              prev.includes(iso)
                ? prev.filter((x) => x !== iso)
                : prev.length >= 4
                  ? prev
                  : [...prev, iso],
            )
          }
        />
      </section>

      <section className="results-card" data-testid="project-family-compare">
        <h2>{t("projectFamilyCompare")}</h2>
        <p className="lead-tight">{t("projectFamilyIntro")}</p>

        <div className="family-compare-cards">
          {familyCompare.projects.map((p) => (
            <article
              key={p.id}
              className="family-card"
              data-testid={`family-card-${p.id}`}
            >
              <h3>{p.label}</h3>
              <dl className="family-card-meta">
                <div>
                  <dt>{t("familyCriteria")}</dt>
                  <dd className="font-tabular">{p.nCriteria}</dd>
                </div>
                <div>
                  <dt>{t("familyVariables")}</dt>
                  <dd className="font-tabular">{p.variableIds.length}</dd>
                </div>
              </dl>
              <p className="muted small family-card-note">{p.methodNotes[0] ?? "—"}</p>
              <p className="small">
                <span className="muted">{t("familyTopMarkets")}: </span>
                <span className="font-tabular">{p.topMarkets.join(" · ")}</span>
              </p>
            </article>
          ))}
        </div>

        {(onlyA.length > 0 || onlyB.length > 0) && projA && projB ? (
          <ul className="family-diff-list">
            {onlyA.length > 0 ? (
              <li>
                <strong>{projA.label}</strong>
                {lang === "es" ? " añade: " : " adds: "}
                <span className="font-tabular">{onlyA.join(", ")}</span>
              </li>
            ) : null}
            {onlyB.length > 0 ? (
              <li>
                <strong>{projB.label}</strong>
                {lang === "es" ? " añade: " : " adds: "}
                <span className="font-tabular">{onlyB.join(", ")}</span>
              </li>
            ) : null}
          </ul>
        ) : null}

        <p className="small family-split-line">
          <span className="muted">{t("combinedSplitLabel")}: </span>
          <span className="font-tabular">
            {eocPct}/{imsfePct}
          </span>
          {model.combined ? (
            <span className="muted" data-testid="combined-applied">
              {" · "}
              {t("combinedApplied").replace("{a}", model.combined.a.toFixed(2))}
            </span>
          ) : null}
        </p>

        <CombinedSplitTable model={model} />

        <button
          type="button"
          className="btn btn-secondary"
          data-testid="export-project-compare"
          onClick={() => {
            const tables = compareExportTables(familyCompare);
            const body = [
              "README",
              ...tables.readme.map((r) => r.join(",")),
              "",
              "WEIGHTS",
              ...tables.weights.map((r) => r.join(",")),
            ].join("\n");
            const blob = new Blob([body], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "ims-atlas-project-compare.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("exportProjectCompare")}
        </button>
      </section>

      <section
        className="results-card"
        data-testid="compare-total"
        data-export-surface="chart"
      >
        <ChartFrame
          testIdPrefix="total"
          title={t("parityTop10Total")}
          chartRef={totalRef}
          showOnScreenCredit
        >
          <Suspense fallback={<p className="muted">{t("loading")}</p>}>
            <Top10Chart
              title={t("parityTop10Total")}
              series={topTotal}
              onReady={(c) => {
                totalRef.current = c;
              }}
            />
          </Suspense>
        </ChartFrame>
      </section>

      <section
        className="results-card"
        data-testid="compare-factor"
        data-export-surface="chart"
      >
        <ChartFrame
          testIdPrefix="factor"
          title={`${t("parityTop10Factor")}: ${factorKey}`}
          chartRef={factorRef}
          showOnScreenCredit
        >
          <Suspense fallback={<p className="muted">{t("loading")}</p>}>
            <Top10Chart
              title={`${t("parityTop10Factor")} (${factorKey})`}
              series={topFactor}
              onReady={(c) => {
                factorRef.current = c;
              }}
            />
          </Suspense>
        </ChartFrame>
      </section>

      <section
        className="results-card"
        data-testid="compare-combo"
        data-export-surface="chart"
      >
        <ChartFrame
          testIdPrefix="combo"
          title={t("parityTop10Combo")}
          chartRef={comboRef}
          showOnScreenCredit
        >
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
        </ChartFrame>
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
      chrome="results"
    >
      {(m) => (m ? <CompareBody model={m} /> : null)}
    </AnalysisPage>
  );
}
