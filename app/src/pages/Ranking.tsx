import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModel";
import { useAnalysis } from "../state/useAnalysis";

const WorldChoropleth = lazy(() =>
  import("../components/WorldChoropleth").then((m) => ({
    default: m.WorldChoropleth,
  })),
);
const FactorBars = lazy(() =>
  import("../components/FactorBars").then((m) => ({ default: m.FactorBars })),
);

export function Ranking() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const { model, error } = useRankingModel();
  const [sortKey, setSortKey] = useState<"rank" | "score" | "iso3">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!model) return [];
    const rows = [...model.ranking];
    rows.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "iso3") return mul * a.iso3.localeCompare(b.iso3);
      if (sortKey === "score") return mul * (a.score - b.score);
      return mul * (a.rank - b.rank);
    });
    return rows;
  }, [model, sortKey, sortDir]);

  const selectedIso = config.compareA ?? sorted[0]?.iso3;
  const compareIso = config.compareB;

  const factors = useMemo(() => {
    if (!model || !selectedIso) return [];
    return Object.keys(model.factorScores[selectedIso] ?? {}).sort();
  }, [model, selectedIso]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  return (
    <section
      className="ranking"
      data-testid="ranking-view"
      aria-labelledby="ranking-title"
    >
      <h1 id="ranking-title">{t("nav.ranking")}</h1>
      <p className="muted">
        {config.origin ?? "—"} / HS{config.hs ?? "—"} / {config.year ?? "—"} ·{" "}
        {config.weightScheme ?? "expert_mean"} · {config.mcdm ?? "wsm"}
      </p>

      {error ? <p className="error">{error}</p> : null}
      {!model && !error ? <p>{t("loading")}</p> : null}

      {model ? (
        <>
          <div className="ranking-meta" data-testid="ranking-meta">
            <span data-testid="ranking-elapsed">
              {t("rerankMs")}: {model.elapsedMs.toFixed(1)} ms
            </span>
            <span>
              n={model.ranking.length} · imputed={model.prepared.nImputedCells}
            </span>
          </div>

          {model.warnings.length > 0 ? (
            <ul className="warnings" data-testid="ranking-warnings">
              {model.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="ranking-layout">
            <div className="ranking-table-wrap">
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
                    const idx = model.prepared.candidates.indexOf(row.iso3);
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
                        onClick={() => {
                          if (!config.compareA || config.compareA === row.iso3) {
                            setConfig({ compareA: row.iso3 });
                          } else if (!config.compareB) {
                            setConfig({ compareB: row.iso3 });
                          } else {
                            setConfig({ compareA: row.iso3, compareB: undefined });
                          }
                        }}
                      >
                        <td>{row.rank}</td>
                        <td>{row.iso3}</td>
                        <td data-testid={`score-${row.iso3}`}>
                          {row.score.toFixed(12)}
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
                  onSelect={(iso3) => setConfig({ compareA: iso3 })}
                />
              </Suspense>
              <p className="licence-note" data-testid="map-licence">
                {t("mapLicence")}
              </p>

              <div className="compare-controls" data-testid="compare-controls">
                <label>
                  A
                  <select
                    value={config.compareA ?? selectedIso ?? ""}
                    onChange={(e) =>
                      setConfig({ compareA: e.target.value || undefined })
                    }
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
                    value={config.compareB ?? ""}
                    onChange={(e) =>
                      setConfig({ compareB: e.target.value || undefined })
                    }
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

              {selectedIso && compareIso ? (
                <div className="compare-scores" data-testid="compare-panel">
                  <h2>
                    {selectedIso} vs {compareIso}
                  </h2>
                  <p>
                    {selectedIso}:{" "}
                    {model.ranking
                      .find((r) => r.iso3 === selectedIso)
                      ?.score.toFixed(6)}{" "}
                    (#{model.ranking.find((r) => r.iso3 === selectedIso)?.rank})
                  </p>
                  <p>
                    {compareIso}:{" "}
                    {model.ranking.find((r) => r.iso3 === compareIso)?.score.toFixed(6)}{" "}
                    (#{model.ranking.find((r) => r.iso3 === compareIso)?.rank})
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
