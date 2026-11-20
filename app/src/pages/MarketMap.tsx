import { useEffect, useMemo, useState } from "react";
import { kMeans2d, silhouette2d, type MarketLayoutResult } from "@ims-atlas/core";
import { useTranslation } from "../i18n";
import { AnalysisPage } from "../components/AnalysisPage";
import { MarketMapCanvas } from "../components/MarketMapCanvas";
import { WorldChoropleth } from "../components/WorldChoropleth";
import { PermalinkLink } from "../components/PermalinkLink";
import { loadRankYearsFixture, type RankYearsFixture } from "../data/loadRankYears";
import { clusterDescriptors } from "../map/clusterDescriptors";
import { analysisErrorMessage } from "../ranking/analysisError";
import { isColHs64Preset } from "../ranking/demoPanel";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useStrategicMatrix } from "../ranking/useStrategicMatrix";
import { useAnalysis } from "../state/useAnalysis";
import { runMarketLayoutWorker } from "../workers/runWorker";

/** Read-only map: geographic choropleth + SMACOF clusters. Config via Variables. */
export function MarketMap() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const { model, error } = useRankingModel();
  const [layout, setLayout] = useState<MarketLayoutResult | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [yearFixture, setYearFixture] = useState<RankYearsFixture | null>(null);
  const [playYearIdx, setPlayYearIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const projection = config.mapProjection ?? "globe";
  const extrude = config.mapExtrude === true;
  const clusterK = config.clusterK ?? 4;
  const mapSeed = config.mapSeed ?? 42;
  const colorMode = config.mapColor === "quadrant" ? "quadrant" : "cluster";
  const mapMode = config.mapMode ?? "network";
  const matrix = useStrategicMatrix(model);

  const paperPreset = isColHs64Preset({
    ...(config.origin !== undefined ? { origin: config.origin } : {}),
    ...(config.hs !== undefined ? { hs: config.hs } : {}),
    ...(config.year !== undefined ? { year: config.year } : {}),
  });

  useEffect(() => {
    if (!paperPreset) {
      setYearFixture(null);
      return;
    }
    let cancelled = false;
    void loadRankYearsFixture()
      .then((f) => {
        if (!cancelled) setYearFixture(f);
      })
      .catch(() => {
        if (!cancelled) setYearFixture(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paperPreset]);

  useEffect(() => {
    if (!playing || !yearFixture || yearFixture.years.length < 2) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPlaying(false);
      return;
    }
    const id = window.setInterval(() => {
      setPlayYearIdx((i) => (i + 1) % yearFixture.years.length);
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, yearFixture]);

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

  const playYear =
    yearFixture && yearFixture.years.length > 0
      ? yearFixture.years[playYearIdx % yearFixture.years.length]
      : null;

  const choroplethRows = useMemo(() => {
    if (!model) return [];
    if (playYear !== null && yearFixture) {
      const ranks = yearFixture.rankings[String(playYear)] ?? [];
      return ranks.map((r) => {
        const q = quadrants?.[r.iso3];
        return q !== undefined
          ? { iso3: r.iso3, score: r.score, rank: r.rank, quadrant: q }
          : { iso3: r.iso3, score: r.score, rank: r.rank };
      });
    }
    return model.ranking.map((r) => {
      const q = quadrants?.[r.iso3];
      return q !== undefined
        ? { iso3: r.iso3, score: r.score, rank: r.rank, quadrant: q }
        : { iso3: r.iso3, score: r.score, rank: r.rank };
    });
  }, [model, quadrants, playYear, yearFixture]);

  const silhouetteSweep = useMemo(() => {
    if (!layout || layout.nodes.length < 4) return [] as { k: number; sil: number }[];
    const points = layout.nodes.map((n) => ({ x: n.x, y: n.y }));
    const out: { k: number; sil: number }[] = [];
    for (let k = 2; k <= 8; k++) {
      const km = kMeans2d(points, k, { seed: mapSeed });
      const sil = silhouette2d(points, km.labels);
      if (sil !== null) out.push({ k, sil });
    }
    return out;
  }, [layout, mapSeed]);

  const currentSil =
    silhouetteSweep.find((s) => s.k === clusterK)?.sil ??
    silhouetteSweep[0]?.sil ??
    null;

  const descriptors = useMemo(() => {
    if (!layout || !model) return {};
    return clusterDescriptors(
      layout.nodes,
      model.factorScores,
      Object.keys(model.weights.factors),
      2,
    );
  }, [layout, model]);

  const combinedError =
    error ?? (layoutError ? analysisErrorMessage(layoutError) : null);

  return (
    <AnalysisPage
      testId="map-view"
      titleKey="nav.map"
      intro={t("mapIntro")}
      model={model}
      error={combinedError}
      chrome="results"
    >
      {() => (
        <div className="map-results" data-testid="map-results">
          <p className="muted small" data-testid="map-view-context">
            {projection === "globe" ? t("mapProjGlobe") : t("mapProjFlat")}
            {extrude ? ` · ${t("mapExtrude3d")}` : ""}
            {` · k=${clusterK}`}
            {" · "}
            <PermalinkLink view="variables">{t("changeAnalysis")}</PermalinkLink>
          </p>

          {yearFixture && yearFixture.years.length > 1 ? (
            <div className="year-play" data-testid="map-year-play">
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="map-year-toggle"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? t("hopPause") : t("yearPlay")}
              </button>
              <span className="muted small font-tabular" data-testid="map-play-year">
                {playYear}
              </span>
              <span className="muted small">{t("yearPlayHint")}</span>
            </div>
          ) : null}

          <WorldChoropleth
            rows={choroplethRows}
            selected={config.compareA}
            origin={config.origin}
            projection={projection}
            extrude={extrude}
            arcsTopN={6}
            onSelect={(iso3) => setConfig({ compareA: iso3 })}
          />

          <h2 className="mt-6">Similarity map (SMACOF)</h2>
          {layout ? (
            <>
              <p className="muted small" data-testid="map-stress">
                SMACOF stress:{" "}
                {layout.stressHistory[layout.stressHistory.length - 1]?.toFixed(6)}{" "}
                (iters {layout.stressHistory.length - 1}) · n={layout.nodes.length} ·
                edges={layout.edges?.length ?? 0}
                {currentSil !== null
                  ? ` · silhouette(k=${clusterK})=${currentSil.toFixed(3)}`
                  : ""}
              </p>
              {currentSil !== null && currentSil < 0.25 ? (
                <p className="note" data-testid="cluster-weak-warn">
                  Silhouette &lt; 0.25 — los grupos son débiles.
                </p>
              ) : null}
              <div
                data-testid="cluster-how"
                className="mb-3 rounded-card border border-border bg-surface p-3"
              >
                <p className="m-0 text-sm font-semibold">How were clusters made?</p>
                <p className="muted small m-0">
                  k-means on SMACOF coordinates · seed {mapSeed} · k {clusterK}.{" "}
                  <PermalinkLink view="variables">
                    {t("clusterKInVariables")}
                  </PermalinkLink>
                </p>
                <div
                  className="mt-2 flex h-16 items-end gap-1"
                  data-testid="silhouette-chart"
                >
                  {silhouetteSweep.map((s) => (
                    <div key={s.k} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-primary"
                        style={{ height: `${Math.max(4, s.sil * 64)}px` }}
                        title={`k=${s.k} sil=${s.sil.toFixed(3)}`}
                      />
                      <span className="text-xs font-tabular text-ink-3">{s.k}</span>
                    </div>
                  ))}
                </div>
                <ul className="compact" data-testid="cluster-descriptors">
                  {Object.entries(descriptors).map(([c, label]) => (
                    <li key={c}>
                      C{c}: {label}
                    </li>
                  ))}
                </ul>
              </div>
              <MarketMapCanvas
                nodes={layout.nodes}
                edges={layout.edges ?? []}
                mode={mapMode}
                colorMode={colorMode}
                quadrants={quadrants}
                selected={config.compareA}
                showHulls
                clusterLabels={descriptors}
                onSelect={(iso3) => setConfig({ compareA: iso3 })}
              />
            </>
          ) : (
            <p data-testid="map-layout-loading">{t("loading")}</p>
          )}
        </div>
      )}
    </AnalysisPage>
  );
}
