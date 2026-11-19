import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildStrategicMatrix, type MarketLayoutResult } from "@ims-atlas/core";
import { MarketMapCanvas } from "../components/MarketMapCanvas";
import { useRankingModel } from "../ranking/useRankingModel";
import { useAnalysis } from "../state/useAnalysis";
import { runEngineWorker } from "../workers/runWorker";

export function MarketMap() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const { model, error } = useRankingModel();
  const [layout, setLayout] = useState<MarketLayoutResult | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  const clusterK = config.clusterK ?? 4;
  const mapSeed = config.mapSeed ?? 42;
  const colorMode = config.mapColor === "quadrant" ? "quadrant" : "cluster";

  useEffect(() => {
    if (!model) {
      setLayout(null);
      return;
    }
    let cancelled = false;
    setLayoutError(null);
    void runEngineWorker({
      type: "market_layout",
      id: `layout-${clusterK}-${mapSeed}`,
      candidates: model.prepared.candidates,
      normalized: model.normalized,
      ranking: model.ranking,
      k: clusterK,
      seed: mapSeed,
    })
      .then((res) => {
        if (!cancelled && res.type === "market_layout") setLayout(res.result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLayout(null);
          setLayoutError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [model, clusterK, mapSeed]);

  const quadrants = useMemo(() => {
    if (!model) return undefined;
    const matrix = buildStrategicMatrix({
      ranking: model.ranking,
      factorScores: model.factorScores,
      cutoff: "median",
    });
    return Object.fromEntries(matrix.points.map((p) => [p.iso3, p.quadrant]));
  }, [model]);

  return (
    <section
      className="market-map-page"
      data-testid="map-view"
      aria-labelledby="map-title"
    >
      <h1 id="map-title">{t("nav.map")}</h1>
      <p className="muted">{t("mapIntro")}</p>

      <div className="matrix-controls" data-testid="map-controls">
        <label>
          k
          <input
            type="number"
            min={2}
            max={12}
            value={clusterK}
            data-testid="cluster-k"
            onChange={(e) => setConfig({ clusterK: Number(e.target.value) || 4 })}
          />
        </label>
        <label>
          {t("mapSeed")}
          <input
            type="number"
            value={mapSeed}
            data-testid="map-seed"
            onChange={(e) => setConfig({ mapSeed: Number(e.target.value) || 42 })}
          />
        </label>
        <label>
          {t("mapColor")}
          <select
            value={colorMode}
            data-testid="map-color"
            onChange={(e) =>
              setConfig({
                mapColor: e.target.value as "cluster" | "quadrant",
              })
            }
          >
            <option value="cluster">{t("colorCluster")}</option>
            <option value="quadrant">{t("colorQuadrant")}</option>
          </select>
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {layoutError ? <p className="error">{layoutError}</p> : null}
      {!model && !error ? <p>{t("loading")}</p> : null}

      {layout ? (
        <>
          <p className="muted small" data-testid="map-stress">
            SMACOF stress:{" "}
            {layout.stressHistory[layout.stressHistory.length - 1]?.toFixed(6)} (iters{" "}
            {layout.stressHistory.length - 1}) · n={layout.nodes.length}
          </p>
          <MarketMapCanvas
            nodes={layout.nodes}
            colorMode={colorMode}
            quadrants={quadrants}
            selected={config.compareA}
            onSelect={(iso3) => setConfig({ compareA: iso3 })}
          />
        </>
      ) : null}
    </section>
  );
}
