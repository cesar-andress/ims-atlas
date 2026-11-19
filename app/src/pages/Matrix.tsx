import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildStrategicMatrix, type AxisMode } from "@ims-atlas/core";
import { StrategicScatter } from "../components/StrategicScatter";
import { useRankingModel } from "../ranking/useRankingModel";
import { useAnalysis } from "../state/useAnalysis";

export function Matrix() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const { model, error } = useRankingModel();

  const cutoff: AxisMode = config.matrixCutoff === "fixed" ? "fixed" : "median";

  const matrix = useMemo(() => {
    if (!model) return null;
    return buildStrategicMatrix({
      ranking: model.ranking,
      factorScores: model.factorScores,
      cutoff,
      ...(cutoff === "fixed"
        ? {
            fixedAttractiveness: config.matrixCutA ?? 0.5,
            fixedFit: config.matrixCutF ?? 0.5,
          }
        : {}),
    });
  }, [model, cutoff, config.matrixCutA, config.matrixCutF]);

  return (
    <section
      className="matrix"
      data-testid="matrix-view"
      aria-labelledby="matrix-title"
    >
      <h1 id="matrix-title">{t("nav.matrix")}</h1>
      <p className="muted">{t("matrixIntro")}</p>

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

      {error ? <p className="error">{error}</p> : null}
      {!model && !error ? <p>{t("loading")}</p> : null}

      {matrix ? (
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
                  <tr key={p.iso3} data-iso3={p.iso3} data-quadrant={p.quadrant}>
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
      ) : null}
    </section>
  );
}
