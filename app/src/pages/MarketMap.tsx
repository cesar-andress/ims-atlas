import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import type { MarketLayoutResult } from "@ims-atlas/core";
import { AnalysisPage } from "../components/AnalysisPage";
import { MarketMapCanvas, type MapMode } from "../components/MarketMapCanvas";
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
  const [focusQuery, setFocusQuery] = useState("");

  const clusterK = config.clusterK ?? 4;
  const mapSeed = config.mapSeed ?? 42;
  const colorMode = config.mapColor === "quadrant" ? "quadrant" : "cluster";
  const mapMode: MapMode = config.mapMode ?? "network";
  const matrix = useStrategicMatrix(model, "median");

  const overlayVarIds = useMemo(() => {
    if (!model) return [] as string[];
    return model.panel.variables.map((v) => v.id);
  }, [model]);

  const overlayVar =
    config.mapOverlayVar && overlayVarIds.includes(config.mapOverlayVar)
      ? config.mapOverlayVar
      : (overlayVarIds[0] ?? "IMPV");

  const overlayValues = useMemo(() => {
    if (!model || mapMode !== "overlay") return undefined;
    const col = model.panel.variables.findIndex((v) => v.id === overlayVar);
    if (col < 0) return undefined;
    const out: Record<string, number | null> = {};
    for (let i = 0; i < model.panel.candidates.length; i++) {
      const iso = model.panel.candidates[i]!;
      out[iso] = model.panel.values[i]?.[col] ?? null;
    }
    return out;
  }, [model, mapMode, overlayVar]);

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
            {t("mapMode")}
            <select
              value={mapMode}
              data-testid="map-mode"
              onChange={(e) =>
                setConfig({
                  mapMode: e.target.value as MapMode,
                })
              }
            >
              <option value="network">{t("mapModeNetwork")}</option>
              <option value="overlay">{t("mapModeOverlay")}</option>
              <option value="density">{t("mapModeDensity")}</option>
            </select>
          </label>
          {mapMode === "overlay" ? (
            <label>
              {t("mapOverlayVar")}
              <select
                value={overlayVar}
                data-testid="map-overlay-var"
                onChange={(e) => setConfig({ mapOverlayVar: e.target.value })}
              >
                {overlayVarIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mapMode === "network" ? (
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
          ) : null}
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
            {t("mapSearch")}
            <input
              value={focusQuery}
              placeholder="USA"
              data-testid="map-search"
              onChange={(e) => setFocusQuery(e.target.value)}
            />
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
              {layout.stressHistory.length - 1}) · n={layout.nodes.length} · edges=
              {layout.edges?.length ?? 0}
            </p>
            <MarketMapCanvas
              nodes={layout.nodes}
              edges={layout.edges ?? []}
              mode={mapMode}
              colorMode={colorMode}
              overlayValues={overlayValues}
              quadrants={quadrants}
              selected={config.compareA}
              focusQuery={focusQuery}
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
