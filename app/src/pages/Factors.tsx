import { useEffect, useMemo, useState } from "react";
import { AnalysisPage } from "../components/AnalysisPage";
import { ExportMenu } from "../components/ExportMenu";
import { VerifyDatumPanel } from "../components/VerifyDatumPanel";
import { formatScore } from "../format";
import { useTranslation } from "../i18n";
import type { RankingViewModel } from "../ranking/rankingEngine";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";

function FactorsBody({ model }: { model: RankingViewModel }) {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const factors = useMemo(
    () => [...new Set(model.panel.variables.map((v) => v.factor))].sort(),
    [model],
  );
  const [factor, setFactor] = useState(factors[0] ?? "demand");
  useEffect(() => {
    if (!factors.includes(factor)) {
      setFactor(factors[0] ?? "demand");
    }
  }, [factors, factor]);
  const iso = config.compareA ?? model.ranking[0]?.iso3;
  const rowIdx = iso ? model.prepared.candidates.indexOf(iso) : -1;

  const rows = useMemo(() => {
    if (rowIdx < 0) return [];
    const used = model.prepared.usedVariables;
    return model.panel.variables
      .filter((v) => v.factor === factor && used.includes(v.id))
      .map((v) => {
        const col = used.indexOf(v.id);
        const rawCol = model.panel.variables.findIndex((x) => x.id === v.id);
        const raw = model.panel.values[rowIdx]?.[rawCol] ?? null;
        const norm = col >= 0 ? (model.normalized[rowIdx]?.[col] ?? null) : null;
        const wWithin = model.weights.variablesWithin[v.factor]?.[v.id] ?? 0;
        const wFactor = model.weights.factors[v.factor] ?? 0;
        const imputed =
          col >= 0 ? Boolean(model.prepared.imputedMask[rowIdx]?.[col]) : false;
        return {
          id: v.id,
          direction: v.direction,
          raw,
          norm,
          weight: wFactor * wWithin,
          imputed,
        };
      });
  }, [model, rowIdx, factor]);

  return (
    <>
      <div className="ranking-meta" data-testid="factors-picker">
        <p className="muted small m-0">{t("transparencyFactor")}</p>
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label={t("transparencyFactor")}
        >
          {factors.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === factor}
              className={f === factor ? "btn btn-primary" : "btn btn-secondary"}
              data-testid={f === factor ? "factor-tab" : `factor-tab-${f}`}
              onClick={() => setFactor(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="muted small m-0">ISO3</p>
        <div className="flex flex-wrap gap-1" data-testid="factor-iso-list">
          {model.ranking.slice(0, 30).map((r) => (
            <button
              key={r.iso3}
              type="button"
              className={r.iso3 === iso ? "btn btn-primary" : "btn btn-secondary"}
              data-testid={r.iso3 === iso ? "factor-iso" : `factor-iso-${r.iso3}`}
              aria-pressed={r.iso3 === iso}
              onClick={() => setConfig({ compareA: r.iso3 })}
            >
              {r.rank}. {r.iso3}
            </button>
          ))}
        </div>
      </div>
      <div className="table-scroll" data-export-surface="table">
        <ExportMenu
          testIdPrefix="factors"
          kind="table"
          title={`Factors ${factor} ${iso ?? ""}`}
          tableRows={[
            ["id", "direction", "raw", "normalised", "weight", "imputed"],
            ...rows.map((r) => [
              r.id,
              r.direction,
              r.raw === null ? "" : String(r.raw),
              r.norm === null ? "" : String(r.norm),
              String(r.weight),
              r.imputed ? "yes" : "no",
            ]),
          ]}
        />
        <table data-testid="factor-criteria-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t("transparencyDirection")}</th>
              <th>{t("parityRaw")}</th>
              <th>{t("parityNormalised")}</th>
              <th>{t("parityWeight")}</th>
              <th>{t("parityImputed")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-var-id={r.id}>
                <td>{r.id}</td>
                <td>{r.direction}</td>
                <td data-testid={`raw-${r.id}`}>
                  {r.raw === null ? "—" : formatScore(r.raw)}{" "}
                  {iso && typeof config.year === "number" ? (
                    <VerifyDatumPanel
                      variableId={r.id}
                      iso3={iso}
                      year={config.year}
                      displayValue={r.raw}
                      sourceIds={[]}
                    />
                  ) : null}
                </td>
                <td data-testid={`norm-${r.id}`}>
                  {r.norm === null ? "—" : formatScore(r.norm)}
                </td>
                <td>{formatScore(r.weight)}</td>
                <td data-imputed={r.imputed ? "1" : "0"}>{r.imputed ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Factors() {
  const { model, error } = useRankingModel();
  return (
    <AnalysisPage
      testId="factors-view"
      titleKey="nav.factors"
      model={model}
      error={error}
    >
      {(m) => (m ? <FactorsBody model={m} /> : null)}
    </AnalysisPage>
  );
}
