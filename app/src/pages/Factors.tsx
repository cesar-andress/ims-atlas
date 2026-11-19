import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { AnalysisPage } from "../components/AnalysisPage";
import { formatScore } from "../format";
import { useRankingModel } from "../ranking/useRankingModel";
import type { RankingViewModel } from "../ranking/rankingEngine";
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
      <div className="ranking-meta">
        <label>
          {t("transparencyFactor")}{" "}
          <select
            data-testid="factor-tab"
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
          >
            {factors.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          ISO3{" "}
          <select
            data-testid="factor-iso"
            value={iso ?? ""}
            onChange={(e) => setConfig({ compareA: e.target.value })}
          >
            {model.ranking.map((r) => (
              <option key={r.iso3} value={r.iso3}>
                {r.rank}. {r.iso3}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll">
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
                  {r.raw === null ? "—" : formatScore(r.raw)}
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
