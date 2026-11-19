import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { AnalysisPage } from "../components/AnalysisPage";
import { formatScore } from "../format";
import { loadT4Fixture, type T4Fixture } from "../data/loadT4Fixture";
import { useRankingModel } from "../ranking/useRankingModel";
import { useAnalysis } from "../state/useAnalysis";
import { scoreBlock, spearmanCorr } from "@ims-atlas/core";

const TARGETS = ["intensive", "new_markets", "growth"] as const;

function leaveOneOutSpearman(
  model: NonNullable<ReturnType<typeof useRankingModel>["model"]>,
) {
  const baseRanks = new Map(model.ranking.map((r) => [r.iso3, r.rank]));
  const rows: { variable: string; spearman: number }[] = [];
  for (const drop of model.prepared.usedVariables) {
    const keep = model.prepared.usedVariables.filter((id) => id !== drop);
    if (keep.length < 2) continue;
    const colIdx = keep.map((id) =>
      model.panel.variables.findIndex((v) => v.id === id),
    );
    const variables = keep.map((id, i) => model.panel.variables[colIdx[i]!]!);
    const values = model.prepared.candidates.map((iso) => {
      const rowIdx = model.panel.candidates.indexOf(iso);
      const row = model.panel.values[rowIdx]!;
      return colIdx.map((j) => row[j]!);
    });
    const result = scoreBlock({
      candidates: model.prepared.candidates,
      variables,
      values,
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "expert_mean",
      policy: { maxMissingShare: 0.2, minCandidates: 20 },
    });
    const a: Record<string, number> = {};
    const b: Record<string, number> = {};
    for (const r of result.ranking) {
      a[r.iso3] = r.rank;
      b[r.iso3] = baseRanks.get(r.iso3)!;
    }
    rows.push({ variable: drop, spearman: spearmanCorr(a, b) });
  }
  rows.sort((x, y) => x.spearman - y.spearman);
  return rows;
}

export function Backtest() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const { model, error } = useRankingModel();
  const [fixture, setFixture] = useState<T4Fixture | null>(null);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const target = (config.backtestTarget as (typeof TARGETS)[number]) ?? "intensive";
  const horizon = config.backtestHorizon === 3 ? 3 : 1;

  useEffect(() => {
    let cancelled = false;
    void loadT4Fixture()
      .then((f) => {
        if (!cancelled) setFixture(f);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFixtureError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metricRows = useMemo(() => {
    if (!fixture) return [];
    return fixture.metrics.filter(
      (r) =>
        r.metric === "ndcg@10" &&
        r.target === target &&
        r.horizon === horizon &&
        (r.method === fixture.focal_method ||
          r.method === "import_volume" ||
          r.method === "gravity_ppml" ||
          r.method === "random"),
    );
  }, [fixture, target, horizon]);

  const liftRows = useMemo(() => {
    if (!fixture) return [];
    return fixture.paired_lift.filter(
      (r) => r.target === target && r.horizon === horizon,
    );
  }, [fixture, target, horizon]);

  const focalNdgc = metricRows.find((r) => r.method === fixture?.focal_method);

  const loo = useMemo(() => (model ? leaveOneOutSpearman(model) : []), [model]);

  const colRow = fixture?.col_hs64.find((r) => r.horizon_k === horizon);

  return (
    <AnalysisPage
      testId="backtest-view"
      titleKey="nav.backtest"
      intro={t("backtestIntro")}
      model={model}
      error={error ?? fixtureError}
      controls={
        <div className="matrix-controls" data-testid="backtest-controls">
          <label>
            {t("backtestTarget")}
            <select
              value={target}
              data-testid="backtest-target"
              onChange={(e) =>
                setConfig({
                  backtestTarget: e.target.value as (typeof TARGETS)[number],
                })
              }
            >
              {TARGETS.map((tg) => (
                <option key={tg} value={tg}>
                  {tg}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("backtestHorizon")}
            <select
              value={horizon}
              data-testid="backtest-horizon"
              onChange={(e) =>
                setConfig({
                  backtestHorizon: Number(e.target.value) === 3 ? 3 : 1,
                })
              }
            >
              <option value={1}>k=1</option>
              <option value={3}>k=3</option>
            </select>
          </label>
        </div>
      }
    >
      {() =>
        fixture ? (
          <div className="backtest-body" data-testid="backtest-body">
            <p className="callout" data-testid="backtest-disclaimer" role="note">
              {t("backtestDisclaimer")}
            </p>
            <p className="muted small" data-testid="backtest-provenance">
              {fixture.provenance}
            </p>

            <h2>{t("ndcgByMethod")}</h2>
            {focalNdgc ? (
              <p data-testid="focal-ndcg">
                {fixture.focal_method} · NDCG@10 ={" "}
                <span data-testid="focal-ndcg-mean" data-mean={String(focalNdgc.mean)}>
                  {formatScore(focalNdgc.mean)}
                </span>{" "}
                [{formatScore(focalNdgc.ci95_low)}, {formatScore(focalNdgc.ci95_high)}]
                · n=
                {focalNdgc.n_blocks}
              </p>
            ) : null}
            <div className="table-scroll">
              <table data-testid="t4-metrics-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>NDCG@10</th>
                    <th>CI low</th>
                    <th>CI high</th>
                    <th>n</th>
                  </tr>
                </thead>
                <tbody>
                  {metricRows.map((r) => (
                    <tr key={r.method} data-method={r.method}>
                      <td>{r.method}</td>
                      <td data-mean={String(r.mean)}>{formatScore(r.mean)}</td>
                      <td>{formatScore(r.ci95_low)}</td>
                      <td>{formatScore(r.ci95_high)}</td>
                      <td>{r.n_blocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {colRow ? (
              <p className="muted" data-testid="col-hs64-ndcg">
                COL · HS64 · horizon {colRow.horizon_k}: mean NDCG@10 ={" "}
                <span data-mean={String(colRow.mean_ndcg_at_10)}>
                  {formatScore(colRow.mean_ndcg_at_10)}
                </span>{" "}
                (n={colRow.n_blocks}, A1 origin_horizon)
              </p>
            ) : null}

            <h2>{t("pairedLift")}</h2>
            <div className="table-scroll">
              <table data-testid="t4-lift-table">
                <thead>
                  <tr>
                    <th>Baseline</th>
                    <th>Δ mean</th>
                    <th>CI low</th>
                    <th>CI high</th>
                  </tr>
                </thead>
                <tbody>
                  {liftRows.map((r) => (
                    <tr key={r.baseline} data-baseline={r.baseline}>
                      <td>{r.baseline}</td>
                      <td data-delta={String(r.delta_mean)}>
                        {formatScore(r.delta_mean)}
                      </td>
                      <td>{formatScore(r.ci95_low)}</td>
                      <td>{formatScore(r.ci95_high)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2>{t("variableValue")}</h2>
            <p className="muted small">{t("variableValueHint")}</p>
            <div className="table-scroll">
              <table data-testid="t6-ablation-table">
                <thead>
                  <tr>
                    <th>Contrast</th>
                    <th>Δ NDCG@10</th>
                    <th>CI low</th>
                    <th>CI high</th>
                  </tr>
                </thead>
                <tbody>
                  {fixture.ablation.map((r) => (
                    <tr key={r.contrast} data-contrast={r.contrast}>
                      <td>{r.contrast}</td>
                      <td data-delta={String(r.delta_mean)}>
                        {formatScore(r.delta_mean)}
                      </td>
                      <td>{formatScore(r.ci95_low)}</td>
                      <td>{formatScore(r.ci95_high)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>{t("looRankSensitivity")}</h3>
            <p className="muted small">{t("looHint")}</p>
            <div className="table-scroll">
              <table data-testid="loo-table">
                <thead>
                  <tr>
                    <th>Variable dropped</th>
                    <th>Spearman vs full</th>
                  </tr>
                </thead>
                <tbody>
                  {loo.map((r) => (
                    <tr key={r.variable} data-variable={r.variable}>
                      <td>{r.variable}</td>
                      <td>{formatScore(r.spearman)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="muted">{t("loading")}</p>
        )
      }
    </AnalysisPage>
  );
}
