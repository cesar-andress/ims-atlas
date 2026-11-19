import { useTranslation } from "../i18n";
import type { AxisMode } from "@ims-atlas/core";
import { AnalysisPage } from "../components/AnalysisPage";
import { StrategicScatter } from "../components/StrategicScatter";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useStrategicMatrix } from "../ranking/useStrategicMatrix";
import { useAnalysis } from "../state/useAnalysis";
import { useCompareSelection } from "../state/useCompareSelection";

export function Matrix() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const { selectIso, isSelected } = useCompareSelection();
  const { model, error } = useRankingModel();
  const cutoff: AxisMode = config.matrixCutoff === "fixed" ? "fixed" : "median";
  const matrix = useStrategicMatrix(model);

  return (
    <AnalysisPage
      testId="matrix-view"
      titleKey="nav.matrix"
      intro={t("matrixIntro")}
      model={model}
      error={error}
      controls={
        <div className="matrix-controls" data-testid="matrix-controls">
          <label>
            {t("matrixCutoff")}
            <select
              value={cutoff}
              onChange={(e) =>
                setConfig({
                  matrixCutoff: e.target.value as AxisMode,
                })
              }
            >
              <option value="median">{t("cutoffMedian")}</option>
              <option value="fixed">{t("cutoffFixed")}</option>
            </select>
          </label>
          {cutoff === "fixed" ? (
            <>
              <label>
                A
                <input
                  type="number"
                  step={0.05}
                  value={config.matrixCutA ?? 0.5}
                  onChange={(e) => setConfig({ matrixCutA: Number(e.target.value) })}
                />
              </label>
              <label>
                Fit
                <input
                  type="number"
                  step={0.05}
                  value={config.matrixCutF ?? 0.5}
                  onChange={(e) => setConfig({ matrixCutF: Number(e.target.value) })}
                />
              </label>
            </>
          ) : null}
        </div>
      }
    >
      {() =>
        matrix ? (
          <>
            <p className="muted small" data-testid="matrix-cuts">
              cut A={matrix.cutAttractiveness.toFixed(3)} · cut Fit=
              {matrix.cutFit.toFixed(3)} · n={matrix.points.length}
            </p>
            <StrategicScatter matrix={matrix} />
            <table className="ranking-table" data-testid="matrix-table">
              <thead>
                <tr>
                  <th>ISO3</th>
                  <th>{t("attractiveness")}</th>
                  <th>{t("fit")}</th>
                  <th>{t("quadrant")}</th>
                  <th>{t("rank")}</th>
                </tr>
              </thead>
              <tbody>
                {[...matrix.points]
                  .sort((a, b) => a.rank - b.rank)
                  .map((p) => (
                    <tr
                      key={p.iso3}
                      data-iso3={p.iso3}
                      data-quadrant={p.quadrant}
                      className={isSelected(p.iso3) ? "selected" : undefined}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected(p.iso3)}
                      onClick={() => selectIso(p.iso3)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectIso(p.iso3);
                        }
                      }}
                    >
                      <td>{p.iso3}</td>
                      <td>{p.attractiveness.toFixed(4)}</td>
                      <td>{p.fit.toFixed(4)}</td>
                      <td>Q{p.quadrant}</td>
                      <td>{p.rank}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        ) : null
      }
    </AnalysisPage>
  );
}
