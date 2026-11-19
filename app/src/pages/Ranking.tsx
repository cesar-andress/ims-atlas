import { lazy, Suspense, useMemo, useState } from "react";
import { AnalysisPage } from "../components/AnalysisPage";
import { VerifyDatumPanel } from "../components/VerifyDatumPanel";
import { rankingToCsv } from "../cite/exportDownload";
import { ExportMenu } from "../components/ExportMenu";
import { formatScore } from "../format";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useCompareSelection } from "../state/useCompareSelection";
import { useAnalysis } from "../state/useAnalysis";
import type { RankingViewModel } from "../ranking/rankingEngine";

const WorldChoropleth = lazy(() =>
  import("../components/WorldChoropleth").then((m) => ({
    default: m.WorldChoropleth,
  })),
);
const FactorBars = lazy(() =>
  import("../components/FactorBars").then((m) => ({ default: m.FactorBars })),
);

function RankingBody({ model }: { model: RankingViewModel }) {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const { compareA, compareB, selectIso, setConfig } = useCompareSelection();
  const [sortKey, setSortKey] = useState<"rank" | "score" | "iso3">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const indexByIso = useMemo(() => {
    const map = new Map<string, number>();
    model.prepared.candidates.forEach((iso, i) => map.set(iso, i));
    return map;
  }, [model.prepared.candidates]);

  const sorted = useMemo(() => {
    const rows = [...model.ranking];
    rows.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "iso3") return mul * a.iso3.localeCompare(b.iso3);
      if (sortKey === "score") return mul * (a.score - b.score);
      return mul * (a.rank - b.rank);
    });
    return rows;
  }, [model.ranking, sortKey, sortDir]);

  const selectedIso = compareA ?? sorted[0]?.iso3;
  const compareIso = compareB;
  const year = config.year;

  const factors = useMemo(() => {
    if (!selectedIso) return [];
    return Object.keys(model.factorScores[selectedIso] ?? {}).sort();
  }, [model.factorScores, selectedIso]);

  const selectedRow = selectedIso
    ? model.ranking.find((r) => r.iso3 === selectedIso)
    : undefined;
  const compareRow = compareIso
    ? model.ranking.find((r) => r.iso3 === compareIso)
    : undefined;

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  return (
    <>
      <div className="ranking-meta" data-testid="ranking-meta">
        <span data-testid="ranking-elapsed">
          {t("rerankMs")}: {model.elapsedMs.toFixed(1)} ms
        </span>
        <span>
          n={model.ranking.length} · imputed={model.prepared.nImputedCells}
        </span>
        {model.panel.synthetic ? (
          <p className="muted small" data-testid="demo-synthetic-note">
            {t("demoSyntheticNote")}
          </p>
        ) : null}
        {model.panel.excludedByod.length > 0 ? (
          <p className="muted small" data-testid="demo-byod-note">
            {t("demoByodExcluded")}
          </p>
        ) : null}
        <ExportMenu
          testIdPrefix="ranking"
          kind="table"
          title={`Ranking ${config.origin ?? ""} HS${config.hs ?? ""} ${config.year ?? ""}`}
          subtitle={`${config.normalization ?? ""} · ${config.mcdm ?? ""}`}
          tableRows={rankingToCsv(model.ranking, model.factorScores)
            .trimEnd()
            .split("\n")
            .map((line) => line.split(","))}
          csvFilename="ranking.csv"
          xlsxFilename="ranking.xlsx"
        />
      </div>

      <div className="ranking-layout">
        <div className="ranking-table-wrap" data-export-surface="table">
          <table className="ranking-table" data-testid="ranking-table">
            <thead>
              <tr>
                <th>
                  <button type="button" onClick={() => toggleSort("rank")}>
                    {t("rank")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("iso3")}>
                    ISO3
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("score")}>
                    {t("score")}
                  </button>
                </th>
                <th>{t("flags")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const idx = indexByIso.get(row.iso3) ?? -1;
                const imputed =
                  idx >= 0 && model.prepared.imputedMask[idx]?.some(Boolean);
                return (
                  <tr
                    key={row.iso3}
                    data-iso3={row.iso3}
                    data-rank={row.rank}
                    className={
                      row.iso3 === selectedIso || row.iso3 === compareIso
                        ? "selected"
                        : undefined
                    }
                    onClick={() => selectIso(row.iso3)}
                  >
                    <td>{row.rank}</td>
                    <td>{row.iso3}</td>
                    <td
                      data-testid={`score-${row.iso3}`}
                      data-score={String(row.score)}
                      title={String(row.score)}
                    >
                      {formatScore(row.score)}
                    </td>
                    <td>{imputed ? t("imputed") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="ranking-side">
          <Suspense fallback={<p className="muted">{t("loading")}</p>}>
            <WorldChoropleth
              rows={model.ranking}
              selected={selectedIso}
              onSelect={selectIso}
            />
          </Suspense>
          <p className="licence-note" data-testid="map-licence">
            {t("mapLicence")}
          </p>

          <div className="compare-controls" data-testid="compare-controls">
            <label>
              A
              <select
                value={compareA ?? selectedIso ?? ""}
                onChange={(e) => setConfig({ compareA: e.target.value || undefined })}
              >
                {model.ranking.map((r) => (
                  <option key={r.iso3} value={r.iso3}>
                    {r.rank}. {r.iso3}
                  </option>
                ))}
              </select>
            </label>
            <label>
              B
              <select
                value={compareB ?? ""}
                onChange={(e) => setConfig({ compareB: e.target.value || undefined })}
              >
                <option value="">—</option>
                {model.ranking.map((r) => (
                  <option key={r.iso3} value={r.iso3}>
                    {r.rank}. {r.iso3}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedIso && factors.length > 0 ? (
            <Suspense fallback={null}>
              <FactorBars
                title={selectedIso}
                factors={factors}
                values={model.factorScores[selectedIso] ?? {}}
                {...(compareIso
                  ? {
                      compare: model.factorScores[compareIso] ?? {},
                      compareLabel: compareIso,
                    }
                  : {})}
              />
            </Suspense>
          ) : null}

          {selectedRow && compareRow ? (
            <div className="compare-scores" data-testid="compare-panel">
              <h2>
                {selectedIso} vs {compareIso}
              </h2>
              <p>
                {selectedIso}: {formatScore(selectedRow.score)} (#{selectedRow.rank})
              </p>
              <p>
                {compareIso}: {formatScore(compareRow.score)} (#{compareRow.rank})
              </p>
            </div>
          ) : null}

          {selectedIso && year !== undefined ? (
            <div className="ranking-why" data-testid="ranking-why">
              <h2>{t("verifyDatum")}</h2>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t("parityRaw")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {model.panel.variables
                    .filter((v) => model.prepared.usedVariables.includes(v.id))
                    .map((v) => {
                      const rowIdx = model.prepared.candidates.indexOf(selectedIso);
                      const rawCol = model.panel.variables.findIndex(
                        (x) => x.id === v.id,
                      );
                      const raw =
                        rowIdx >= 0
                          ? (model.panel.values[rowIdx]?.[rawCol] ?? null)
                          : null;
                      return (
                        <tr key={v.id}>
                          <td>{v.id}</td>
                          <td>{raw === null ? "—" : formatScore(raw)}</td>
                          <td>
                            <VerifyDatumPanel
                              variableId={v.id}
                              iso3={selectedIso}
                              year={year}
                              displayValue={raw}
                              sourceIds={[]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function Ranking() {
  const { model, error } = useRankingModel();

  return (
    <AnalysisPage
      testId="ranking-view"
      titleKey="nav.ranking"
      model={model}
      error={error}
    >
      {(m) => (m ? <RankingBody model={m} /> : null)}
    </AnalysisPage>
  );
}
