import { useRef } from "react";
import { IMSFE_EOC_QUADRANTS, type ImsfeEocQuadrant } from "@ims-atlas/core";
import { AnalysisPage } from "../components/AnalysisPage";
import { ExportMenu } from "../components/ExportMenu";
import { StrategicScatter } from "../components/StrategicScatter";
import { useTranslation } from "../i18n";
import { useImsfeEocMatrix } from "../ranking/useImsfeEocMatrix";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useStrategicMatrix } from "../ranking/useStrategicMatrix";
import { useAnalysis } from "../state/useAnalysis";
import { useCompareSelection } from "../state/useCompareSelection";

type ChartHandle = { getDataURL: (opts: object) => string };

function quadrantLabel(q: ImsfeEocQuadrant, lang: string | undefined): string {
  const row = IMSFE_EOC_QUADRANTS[q];
  return lang === "en" ? row.en : row.es;
}

export function Matrix() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { config } = useAnalysis();
  const { selectIso, isSelected } = useCompareSelection();
  const { model, error } = useRankingModel();
  const mode = config.matrixMode === "imsfe_eoc" ? "imsfe_eoc" : "attractiveness_fit";
  const matrix = useStrategicMatrix(mode === "attractiveness_fit" ? model : null);
  const eocMatrix = useImsfeEocMatrix(mode === "imsfe_eoc" ? model : null);
  const scatterRef = useRef<ChartHandle | null>(null);

  return (
    <AnalysisPage
      testId="matrix-view"
      titleKey="nav.matrix"
      intro={mode === "imsfe_eoc" ? t("matrixIntroEoc") : t("matrixIntro")}
      model={model}
      error={error}
      allowWithoutModel
      chrome="results"
    >
      {() => {
        if (mode === "imsfe_eoc") {
          return (
            <>
              <p
                className="muted small"
                data-testid="matrix-mode"
                data-mode="imsfe_eoc"
              >
                {t("matrixModeImsfeEoc")}
              </p>
              <p className="muted small" data-testid="matrix-authors-note">
                {t("matrixAuthorsNote")}
              </p>
              <ul className="muted small" data-testid="imsfe-eoc-legend">
                {([1, 2, 3, 4] as const).map((q) => (
                  <li key={q}>
                    Q{q}: {quadrantLabel(q, lang)} ({IMSFE_EOC_QUADRANTS[q].rule})
                  </li>
                ))}
              </ul>
              {eocMatrix ? (
                <>
                  <p className="muted small" data-testid="matrix-cuts">
                    cut IMSFE={eocMatrix.cutImsfe.toFixed(3)} · cut EOC=
                    {eocMatrix.cutEoc.toFixed(3)} · n={eocMatrix.points.length}
                  </p>
                  <div data-export-surface="table">
                    <ExportMenu
                      testIdPrefix="matrix-eoc"
                      kind="table"
                      title="IMSFE×EOC matrix"
                      tableRows={[
                        ["iso3", "imsfe", "eoc", "quadrant", "rank"],
                        ...[...eocMatrix.points]
                          .sort((a, b) => a.rank - b.rank)
                          .map((p) => [
                            p.iso3,
                            p.imsfe.toFixed(4),
                            p.eocNorm.toFixed(4),
                            String(p.quadrant),
                            String(p.rank),
                          ]),
                      ]}
                    />
                    <table className="ranking-table" data-testid="matrix-table">
                      <thead>
                        <tr>
                          <th>ISO3</th>
                          <th>IMSFE</th>
                          <th>EOC</th>
                          <th>{t("quadrant")}</th>
                          <th>{t("rank")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...eocMatrix.points]
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
                              <td>{p.imsfe.toFixed(4)}</td>
                              <td>{p.eocNorm.toFixed(4)}</td>
                              <td>{quadrantLabel(p.quadrant, lang)}</td>
                              <td>{p.rank}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted" data-testid="matrix-eoc-pending">
                  {t("matrixEocPending")}
                </p>
              )}
            </>
          );
        }

        return matrix ? (
          <>
            <p className="muted small" data-testid="matrix-cuts">
              cut A={matrix.cutAttractiveness.toFixed(3)} · cut Fit=
              {matrix.cutFit.toFixed(3)} · n={matrix.points.length}
            </p>
            <div data-export-surface="chart">
              <ExportMenu
                testIdPrefix="matrix-scatter"
                kind="chart"
                title="Strategic matrix scatter"
                chartRef={scatterRef}
              />
              <StrategicScatter
                matrix={matrix}
                onReady={(c) => {
                  scatterRef.current = c;
                }}
              />
            </div>
            <div data-export-surface="table">
              <ExportMenu
                testIdPrefix="matrix"
                kind="table"
                title="Strategic matrix"
                tableRows={[
                  ["iso3", "attractiveness", "fit", "quadrant", "rank"],
                  ...[...matrix.points]
                    .sort((a, b) => a.rank - b.rank)
                    .map((p) => [
                      p.iso3,
                      p.attractiveness.toFixed(4),
                      p.fit.toFixed(4),
                      String(p.quadrant),
                      String(p.rank),
                    ]),
                ]}
              />
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
            </div>
          </>
        ) : null;
      }}
    </AnalysisPage>
  );
}
