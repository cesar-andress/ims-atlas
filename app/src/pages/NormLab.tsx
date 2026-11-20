import { useMemo, useState } from "react";
import {
  compareRankings,
  correlationMatrix,
  describeReferenceSet,
  highCorrelationWarnings,
  runColumnPipeline,
  whitenMatrix,
  type ColumnPipelineConfig,
  type OutlierTreatment,
  type ReferenceSet,
  type ScaleMethod,
  type SkewTransform,
  type YearPooling,
} from "@ims-atlas/core";
import { AnalysisPage } from "../components/AnalysisPage";
import { ExportMenu } from "../components/ExportMenu";
import { PermalinkLink } from "../components/PermalinkLink";
import { useTranslation } from "../i18n";
import type { RankingViewModel } from "../ranking/rankingEngine";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";

function histogramBins(values: readonly number[], nBins = 8): number[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return Array.from({ length: nBins }, () => 0);
  const vmin = Math.min(...finite);
  const vmax = Math.max(...finite);
  const span = vmax - vmin || 1;
  const bins = Array.from({ length: nBins }, () => 0);
  for (const v of finite) {
    const idx = Math.min(nBins - 1, Math.floor(((v - vmin) / span) * nBins));
    bins[idx]! += 1;
  }
  return bins;
}

function Histogram({
  values,
  label,
  testId,
}: {
  values: readonly number[];
  label: string;
  testId: string;
}) {
  const bins = histogramBins(values);
  const max = Math.max(1, ...bins);
  return (
    <div className="norm-hist" data-testid={testId} aria-label={label}>
      <p className="small muted">{label}</p>
      <div className="norm-hist-bars">
        {bins.map((c, i) => (
          <div
            key={i}
            className="norm-hist-bar"
            style={{ height: `${(c / max) * 100}%` }}
            title={String(c)}
          />
        ))}
      </div>
    </div>
  );
}

function scaleFromConfig(
  normalization: string | undefined,
  labScale: ScaleMethod | undefined,
): ScaleMethod {
  if (labScale) return labScale;
  switch (normalization) {
    case "ratio_legacy":
      return "ratio";
    case "zscore":
      return "zscore";
    case "robust_z":
      return "robust_z";
    case "rank":
      return "rank";
    case "log_minmax":
      return "minmax";
    default:
      return "minmax";
  }
}

function NormLabBody({ model }: { model: RankingViewModel }) {
  const { t, i18n } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  const used = model.prepared.usedVariables;
  const varId =
    config.focusVariable && used.includes(config.focusVariable)
      ? config.focusVariable
      : (used[0] ?? model.panel.variables[0]?.id ?? "");

  const skew = (config.labSkew ?? "none") as SkewTransform;
  const outlier = (config.labOutlier ?? "none") as OutlierTreatment;
  const scaleA = scaleFromConfig(config.normalization, config.labScale);
  const scaleB = (config.labCompareScale ?? "zscore") as ScaleMethod;
  const referenceSet = (config.labReferenceSet ?? "candidates") as ReferenceSet;
  const yearPooling = (config.labYearPooling ?? "per_year") as YearPooling;
  const decorrelate = Boolean(config.labDecorrelate);

  const colIdx = model.panel.variables.findIndex((v) => v.id === varId);
  const direction = model.panel.variables[colIdx]?.direction ?? ("benefit" as const);

  const rawSeries = useMemo(() => {
    if (colIdx < 0) return [] as (number | null)[];
    return model.prepared.candidates.map((_, i) => {
      const panelRow = model.panel.candidates.indexOf(model.prepared.candidates[i]!);
      return model.panel.values[panelRow]?.[colIdx] ?? null;
    });
  }, [model, colIdx]);

  const pipeA: ColumnPipelineConfig = {
    skew: config.normalization === "log_minmax" ? "log" : skew,
    outlier,
    scale: scaleA,
    direction,
    scaleMax: 10,
  };
  const pipeB: ColumnPipelineConfig = {
    skew,
    outlier,
    scale: scaleB,
    direction,
    scaleMax: 10,
  };

  const afterA = useMemo(
    () => runColumnPipeline(rawSeries, pipeA),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pipe fields listed below
    [rawSeries, skew, outlier, scaleA, direction, config.normalization],
  );
  const afterB = useMemo(
    () => runColumnPipeline(rawSeries, pipeB),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawSeries, skew, outlier, scaleB, direction],
  );

  const topBottomA = useMemo(() => {
    const pairs = model.prepared.candidates
      .map((iso3, i) => ({ iso3, value: afterA.values[i]! }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => b.value - a.value);
    return {
      top: pairs.slice(0, 5),
      bottom: [...pairs].reverse().slice(0, 5),
    };
  }, [model, afterA]);

  const corr = useMemo(() => {
    const cols = used.slice(0, 12);
    const series = cols.map((id) => {
      const j = model.panel.variables.findIndex((v) => v.id === id);
      return model.prepared.candidates.map((iso) => {
        const row = model.panel.candidates.indexOf(iso);
        return j >= 0 ? (model.panel.values[row]?.[j] ?? null) : null;
      });
    });
    const mat = correlationMatrix(cols, series);
    return { cols, mat, warns: highCorrelationWarnings(cols, mat, 0.8) };
  }, [model, used]);

  const compare = useMemo(() => {
    const ranksFromCol = (values: readonly number[]) => {
      const order = model.prepared.candidates
        .map((iso3, i) => ({ iso3, score: values[i] ?? Number.NaN, i }))
        .filter((r) => Number.isFinite(r.score))
        .sort((a, b) => b.score - a.score || a.iso3.localeCompare(b.iso3));
      return order.map((row, rank0) => ({
        iso3: row.iso3,
        score: row.score,
        rank: rank0 + 1,
      }));
    };
    return compareRankings(
      ranksFromCol(afterA.values),
      ranksFromCol(afterB.values),
      10,
    );
  }, [model, afterA, afterB]);

  const whitenedNote = useMemo(() => {
    if (!decorrelate || used.length < 2) return null;
    const matrix = model.prepared.matrix;
    const w = whitenMatrix(matrix);
    return { rows: w.length, cols: w[0]?.length ?? 0 };
  }, [decorrelate, model, used.length]);

  const refCopy = describeReferenceSet(referenceSet, yearPooling);

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="norm-lab" data-testid="norm-lab-body">
      <p className="muted small" data-testid="norm-lab-ref">
        {lang === "es" ? refCopy.es : refCopy.en}
      </p>
      <p className="small">
        <PermalinkLink view="docs">{t("normLabDocsLink")}</PermalinkLink>
      </p>

      <div className="norm-lab-controls">
        <label>
          {t("variables")}
          <select
            data-testid="norm-lab-variable"
            value={varId}
            onChange={(e) => setConfig({ focusVariable: e.target.value })}
          >
            {used.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("normLabSkew")}
          <select
            data-testid="norm-lab-skew"
            value={skew}
            onChange={(e) => setConfig({ labSkew: e.target.value as SkewTransform })}
          >
            <option value="none">none</option>
            <option value="log">log</option>
            <option value="log1p">log1p</option>
          </select>
        </label>
        <label>
          {t("normLabOutlier")}
          <select
            data-testid="norm-lab-outlier"
            value={outlier}
            onChange={(e) =>
              setConfig({ labOutlier: e.target.value as OutlierTreatment })
            }
          >
            <option value="none">none</option>
            <option value="winsor_1_99">winsor 1–99</option>
            <option value="winsor_5_95">winsor 5–95</option>
          </select>
        </label>
        <label>
          {t("normLabScaleA")}
          <select
            data-testid="norm-lab-scale-a"
            value={scaleA}
            onChange={(e) => setConfig({ labScale: e.target.value as ScaleMethod })}
          >
            <option value="ratio">ratio 0–10</option>
            <option value="minmax">minmax 0–10</option>
            <option value="zscore">zscore</option>
            <option value="robust_z">robust_z</option>
            <option value="rank">rank</option>
          </select>
        </label>
        <label>
          {t("normLabScaleB")}
          <select
            data-testid="norm-lab-scale-b"
            value={scaleB}
            onChange={(e) =>
              setConfig({ labCompareScale: e.target.value as ScaleMethod })
            }
          >
            <option value="ratio">ratio 0–10</option>
            <option value="minmax">minmax 0–10</option>
            <option value="zscore">zscore</option>
            <option value="robust_z">robust_z</option>
            <option value="rank">rank</option>
          </select>
        </label>
        <label>
          {t("normLabReference")}
          <select
            data-testid="norm-lab-reference"
            value={referenceSet}
            onChange={(e) =>
              setConfig({ labReferenceSet: e.target.value as ReferenceSet })
            }
          >
            <option value="candidates">candidates</option>
            <option value="all_countries">all_countries</option>
            <option value="base_year">base_year</option>
          </select>
        </label>
        <label>
          {t("normLabPooling")}
          <select
            data-testid="norm-lab-pooling"
            value={yearPooling}
            onChange={(e) =>
              setConfig({ labYearPooling: e.target.value as YearPooling })
            }
          >
            <option value="per_year">per_year</option>
            <option value="pooled">pooled</option>
          </select>
        </label>
      </div>

      <details
        className="norm-lab-advanced"
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
      >
        <summary data-testid="norm-lab-advanced-toggle">{t("normLabAdvanced")}</summary>
        <label className="norm-lab-check">
          <input
            type="checkbox"
            data-testid="norm-lab-decorrelate"
            checked={decorrelate}
            onChange={(e) => setConfig({ labDecorrelate: e.target.checked })}
          />{" "}
          {t("normLabDecorrelate")}
        </label>
        <p className="muted small">{t("normLabDecorrelateWarn")}</p>
        {whitenedNote ? (
          <p className="small" data-testid="norm-lab-whiten-note">
            {t("normLabWhitenApplied")
              .replace("{rows}", String(whitenedNote.rows))
              .replace("{cols}", String(whitenedNote.cols))}
          </p>
        ) : null}
      </details>

      <div className="norm-lab-hist-row">
        <Histogram
          values={rawSeries.map((v) => (v == null ? Number.NaN : v))}
          label={t("normLabBefore")}
          testId="norm-lab-hist-before"
        />
        <Histogram
          values={afterA.values}
          label={`${t("normLabAfter")} (${scaleA})`}
          testId="norm-lab-hist-after"
        />
      </div>

      {afterA.winsorFlags.some(Boolean) ? (
        <p className="small" data-testid="norm-lab-winsor-flag">
          {t("normLabWinsorFlag").replace(
            "{n}",
            String(afterA.winsorFlags.filter(Boolean).length),
          )}
        </p>
      ) : null}

      <div className="norm-lab-tables" data-export-surface="table">
        <ExportMenu
          testIdPrefix="norm-lab-extremes"
          kind="table"
          title="Norm lab top/bottom"
          tableRows={[
            ["group", "iso3", "value"],
            ...topBottomA.top.map((r) => ["top", r.iso3, r.value.toFixed(4)]),
            ...topBottomA.bottom.map((r) => ["bottom", r.iso3, r.value.toFixed(4)]),
          ]}
        />
        <section>
          <h2>{t("normLabTop5")}</h2>
          <table data-testid="norm-lab-top5">
            <thead>
              <tr>
                <th>ISO3</th>
                <th>{t("parityNormalised")}</th>
              </tr>
            </thead>
            <tbody>
              {topBottomA.top.map((r) => (
                <tr key={`t-${r.iso3}`}>
                  <td>{r.iso3}</td>
                  <td>{r.value.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2>{t("normLabBottom5")}</h2>
          <table data-testid="norm-lab-bottom5">
            <thead>
              <tr>
                <th>ISO3</th>
                <th>{t("parityNormalised")}</th>
              </tr>
            </thead>
            <tbody>
              {topBottomA.bottom.map((r) => (
                <tr key={`b-${r.iso3}`}>
                  <td>{r.iso3}</td>
                  <td>{r.value.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section data-testid="norm-lab-compare">
        <h2>{t("normLabCompareTitle")}</h2>
        <p className="small" data-testid="norm-lab-spearman">
          Spearman ={" "}
          {Number.isFinite(compare.spearman) ? compare.spearman.toFixed(4) : "-"}
          {" · "}
          {t("normLabTop10Overlap")} = {(compare.top10Overlap * 10).toFixed(0)}/10
        </p>
        <div data-export-surface="table">
          <ExportMenu
            testIdPrefix="norm-lab-delta"
            kind="table"
            title="Norm lab rank delta"
            tableRows={[
              ["iso3", `rank_A_${scaleA}`, `rank_B_${scaleB}`, "delta"],
              ...compare.rows
                .slice(0, 15)
                .map((r) => [
                  r.iso3,
                  String(r.rankA),
                  String(r.rankB),
                  String(r.delta),
                ]),
            ]}
          />
          <table data-testid="norm-lab-rank-delta">
            <thead>
              <tr>
                <th>ISO3</th>
                <th>A ({scaleA})</th>
                <th>B ({scaleB})</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {compare.rows.slice(0, 15).map((r) => (
                <tr
                  key={r.iso3}
                  className={r.delta !== 0 ? "norm-lab-delta" : undefined}
                >
                  <td>{r.iso3}</td>
                  <td>{r.rankA}</td>
                  <td>{r.rankB}</td>
                  <td>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section data-testid="norm-lab-corr">
        <h2>{t("normLabCorrTitle")}</h2>
        {corr.warns.length === 0 ? (
          <p className="muted small">{t("normLabCorrNone")}</p>
        ) : (
          <ul data-testid="norm-lab-corr-warns">
            {corr.warns.map((w) => (
              <li key={`${w.a}-${w.b}`}>{lang === "es" ? w.messageEs : w.messageEn}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Phase Z normalisation laboratory. */
export function NormLab() {
  const { t } = useTranslation();
  const { model, error } = useRankingModel();

  return (
    <AnalysisPage
      testId="norm-lab-view"
      titleKey="nav.norm_lab"
      intro={t("normLabIntro")}
      model={model}
      error={error}
    >
      {(m) => (m ? <NormLabBody model={m} /> : null)}
    </AnalysisPage>
  );
}
