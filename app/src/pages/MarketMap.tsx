import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import type { MarketLayoutResult } from "@ims-atlas/core";
import { AnalysisPage } from "../components/AnalysisPage";
import { MarketMapCanvas } from "../components/MarketMapCanvas";
import { useRankingModel } from "../ranking/useRankingModel";
import { useStrategicMatrix } from "../ranking/useStrategicMatrix";
import { useAnalysis } from "../state/useAnalysis";
import { runMarketLayoutWorker } from "../workers/runWorker";

export function MarketMap() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const { model, error } = useRankingModel();
  const [layout, setLayout] = useState<MarketLayoutResult | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  const clusterK = config.clusterK ?? 4;
  const mapSeed = config.mapSeed ?? 42;
  const colorMode = config.mapColor === "quadrant" ? "quadrant" : "cluster";
  const matrix = useStrategicMatrix(model, "median");

  useEffect(() => {
    if (!model) {
      setLayout(null);
      return;
    }
    let cancelled = false;
    setLayoutError(null);
    void runMarketLayoutWorker({
      type: "market_layout",
      id: `layout-${clusterK}-${mapSeed}`,
      candidates: model.prepared.candidates,
      normalized: model.normalized,
      ranking: model.ranking,
      k: clusterK,
      seed: mapSeed,
    })
      .then((result) => {
        if (!cancelled) setLayout(result);
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
    if (!matrix) return undefined;
    return Object.fromEntries(matrix.points.map((p) => [p.iso3, p.quadrant]));
  }, [matrix]);

  const combinedError = error ?? layoutError;

  return (
    <AnalysisPage
      testId="map-view"
      titleKey="nav.map"
      intro={t("mapIntro")}
      model={model}
      error={combinedError}
      controls={
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
      }
    >
      {() =>
        layout ? (
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
        ) : (
          <p data-testid="map-layout-loading">{t("loading")}</p>
        )
      }
    </AnalysisPage>
  );
}
