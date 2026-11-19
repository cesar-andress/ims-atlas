import { lazy, Suspense, useMemo } from "react";
import { useTranslation } from "../i18n";
import { AnalysisPage } from "../components/AnalysisPage";
import { formatScore } from "../format";
import { analysisErrorMessage } from "../ranking/analysisError";
import { useRankingModel } from "../ranking/useRankingModel";
import { useSmaaModel } from "../ranking/useSmaaModel";

const RankAcceptabilityChart = lazy(() =>
  import("../components/RankAcceptabilityChart").then((m) => ({
    default: m.RankAcceptabilityChart,
  })),
);
const TornadoChart = lazy(() =>
  import("../components/TornadoChart").then((m) => ({ default: m.TornadoChart })),
);

export function Uncertainty() {
  const { t } = useTranslation();
  const { model, error: rankError, loading: rankLoading } = useRankingModel();
  const { smaaModel, error: smaaError, loading: smaaLoading } = useSmaaModel(model);
  const combinedError =
    rankError ?? (smaaError ? analysisErrorMessage(smaaError) : null);
  const loading = rankLoading || smaaLoading;

  const topRows = useMemo(() => {
    if (!smaaModel) return [];
    const { smaa, pTop1, pTop5, pTop10 } = smaaModel;
    return smaa.alternatives
      .map((iso, i) => ({
        iso3: iso,
        p1: pTop1[i]!,
        p5: pTop5[i]!,
        p10: pTop10[i]!,
      }))
      .sort(
        (a, b) =>
          b.p10 - a.p10 || b.p5 - a.p5 || b.p1 - a.p1 || a.iso3.localeCompare(b.iso3),
      )
      .slice(0, 15);
  }, [smaaModel]);

  const central = useMemo(() => {
    if (!smaaModel) return [];
    return Object.entries(smaaModel.smaa.centralWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18);
  }, [smaaModel]);

  return (
    <AnalysisPage
      testId="uncertainty-view"
      titleKey="nav.uncertainty"
      intro={t("uncertaintyIntro")}
      model={model}
      error={combinedError}
    >
      {(m) => (
        <div className="uncertainty-body" data-testid="uncertainty-body">
          {loading || !smaaModel ? (
            <p className="muted" data-testid="smaa-loading">
              {t("loading")}
            </p>
          ) : (
            <>
              <p className="muted small" data-testid="smaa-meta">
                SMAA Dirichlet · n={smaaModel.nSamples} · seed={smaaModel.smaa.seed} ·{" "}
                {m.prepared.candidates.length} destinations
              </p>
              <Suspense fallback={<p className="muted">{t("loading")}</p>}>
                <RankAcceptabilityChart
                  alternatives={smaaModel.smaa.alternatives}
                  acceptability={smaaModel.smaa.acceptability}
                />
              </Suspense>

              <h2>{t("pTopKTable")}</h2>
              <div className="table-scroll">
                <table data-testid="ptop-table">
                  <thead>
                    <tr>
                      <th>ISO3</th>
                      <th>P(top-1)</th>
                      <th>P(top-5)</th>
                      <th>P(top-10)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRows.map((row) => (
                      <tr key={row.iso3} data-iso3={row.iso3}>
                        <td>{row.iso3}</td>
                        <td data-testid={`p1-${row.iso3}`}>{formatScore(row.p1)}</td>
                        <td>{formatScore(row.p5)}</td>
                        <td>{formatScore(row.p10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2>{t("centralWeights")}</h2>
              <ul className="central-weights" data-testid="central-weights">
                {central.map(([id, w]) => (
                  <li key={id}>
                    <code>{id}</code>: {formatScore(w)}
                  </li>
                ))}
              </ul>

              <h2>{t("tornadoTitle")}</h2>
              <p className="muted small">{t("tornadoHint")}</p>
              <Suspense fallback={<p className="muted">{t("loading")}</p>}>
                <TornadoChart bars={smaaModel.tornado} />
              </Suspense>
              <table data-testid="tornado-table" className="small">
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th>−50%</th>
                    <th>+50%</th>
                  </tr>
                </thead>
                <tbody>
                  {smaaModel.tornado
                    .filter((b) => b.level === "factor")
                    .map((b) => (
                      <tr key={b.id} data-factor={b.id}>
                        <td>{b.id}</td>
                        <td>{formatScore(b.lowDelta)}</td>
                        <td>{formatScore(b.highDelta)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </AnalysisPage>
  );
}
