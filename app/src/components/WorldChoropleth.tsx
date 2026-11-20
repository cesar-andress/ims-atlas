import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { neGeojsonUrl } from "../geo/neGeojson";

/** ISO_A3 keyed scores for choropleth fill. */
export type ChoroplethDatum = {
  iso3: string;
  score: number;
  rank: number;
  quadrant?: number;
  /** Import volume proxy for arc line width (optional). */
  imports?: number;
};

type Props = {
  rows: ChoroplethDatum[];
  selected?: string | undefined;
  origin?: string | undefined;
  onSelect?: ((iso3: string) => void) | undefined;
  /** Flat vs globe projection (MapLibre globe). */
  projection?: "mercator" | "globe";
  /** Extrude country polygons by score (3D). */
  extrude?: boolean;
  /** Great-circle arcs from origin to top markets. */
  arcsTopN?: number;
};

function scoreColor(t: number): string {
  const r = Math.round(20 + (220 - 20) * (1 - t));
  const g = Math.round(95 + (180 - 95) * t);
  const b = Math.round(74 + (40 - 74) * (1 - t));
  return `rgb(${r},${g},${b})`;
}

function greatCircle(
  from: [number, number],
  to: [number, number],
  steps = 32,
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lon1, lat1] = [toRad(from[0]), toRad(from[1])];
  const [lon2, lat2] = [toRad(to[0]), toRad(to[1])];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );
  if (d < 1e-9) return [from, to];
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    coords.push([
      toDeg(Math.atan2(y, x)),
      toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    ]);
  }
  return coords;
}

/** Rough centroid lon/lat from Natural Earth feature bbox centre (fallback table). */
const ISO_CENTROID: Record<string, [number, number]> = {
  COL: [-74.3, 4.6],
  USA: [-98, 39],
  DEU: [10.5, 51.2],
  CZE: [15.5, 49.8],
  CHN: [104, 35],
  BRA: [-53, -14],
  MEX: [-102, 23],
  ESP: [-3.7, 40.4],
  FRA: [2.2, 46.2],
  GBR: [-2.5, 54.2],
  ITA: [12.5, 42.5],
  JPN: [138, 36],
  KOR: [127.8, 36.5],
  CAN: [-106, 56],
  AUS: [134, -25],
  IND: [79, 22],
  NLD: [5.3, 52.1],
  BEL: [4.5, 50.5],
  POL: [19.4, 52.1],
  TUR: [35.2, 39],
};

/**
 * MapLibre choropleth with optional globe, extrusion and origin arcs.
 * Basemap: Natural Earth 110m (public domain). Lazy-loads maplibre-gl.
 */
export function WorldChoropleth({
  rows,
  selected,
  origin,
  onSelect,
  projection = "globe",
  extrude = false,
  arcsTopN = 5,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rowsRef = useRef(rows);
  const onSelectRef = useRef(onSelect);
  const [active, setActive] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  rowsRef.current = rows;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || active) return;
    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active]);

  useEffect(() => {
    if (!active || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    void (async () => {
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) {
          setWebglOk(false);
          return;
        }
      } catch {
        setWebglOk(false);
        return;
      }

      const maplibregl = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            ne: {
              type: "geojson",
              data: neGeojsonUrl(),
            },
          },
          layers: [
            {
              id: "bg",
              type: "background",
              paint: { "background-color": "#dfe6e9" },
            },
            {
              id: "countries-fill",
              type: "fill",
              source: "ne",
              paint: {
                "fill-color": "#c8ccc8",
                "fill-opacity": 0.95,
              },
            },
            {
              id: "countries-line",
              type: "line",
              source: "ne",
              paint: {
                "line-color": "#6a6e6a",
                "line-width": 0.4,
              },
            },
          ],
        },
        center: [10, 20],
        zoom: 1.35,
        pitch: extrude ? 45 : 0,
        attributionControl: { compact: true },
      });

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "top-right",
      );

      map.on("load", () => {
        if (!map) return;
        try {
          if (projection === "globe" && "setProjection" in map) {
            (
              map as MapLibreMap & { setProjection: (p: { type: string }) => void }
            ).setProjection({
              type: "globe",
            });
          }
        } catch {
          /* older MapLibre without globe */
        }
        applyColors(map, rowsRef.current, selected, origin, extrude);
        applyArcs(map, rowsRef.current, origin, arcsTopN);
      });

      map.on("click", "countries-fill", (e) => {
        const f = e.features?.[0];
        const iso =
          (f?.properties?.ADM0_A3 as string | undefined) ??
          (f?.properties?.ISO_A3 as string | undefined);
        if (iso && onSelectRef.current) onSelectRef.current(iso);
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once when active
  }, [active]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (projection === "globe" && "setProjection" in map) {
        (
          map as MapLibreMap & { setProjection: (p: { type: string }) => void }
        ).setProjection({
          type: "globe",
        });
      } else if ("setProjection" in map) {
        (
          map as MapLibreMap & { setProjection: (p: { type: string }) => void }
        ).setProjection({
          type: "mercator",
        });
      }
    } catch {
      /* ignore */
    }
    map.setPitch(extrude ? 45 : 0);
    applyColors(map, rows, selected, origin, extrude);
    applyArcs(map, rows, origin, arcsTopN);
  }, [rows, selected, origin, projection, extrude, arcsTopN]);

  const scores = rows.map((r) => r.score);
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 1;

  return (
    <div className="choropleth-wrap" data-testid="world-choropleth-wrap">
      {!webglOk ? (
        <p className="muted" data-testid="choropleth-webgl-fallback">
          WebGL unavailable — showing 2D fallback unavailable; open the similarity map
          below.
        </p>
      ) : null}
      <div
        className="choropleth"
        data-testid="world-choropleth"
        ref={containerRef}
        role="img"
        aria-label="World choropleth of ranking scores"
        style={{ height: 420, borderRadius: 14, overflow: "hidden" }}
      />
      <div className="choropleth-legend" data-testid="choropleth-legend">
        <span className="muted small">Score (colour)</span>
        <div
          className="choropleth-legend-bar"
          style={{
            height: 10,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${scoreColor(0)}, ${scoreColor(1)})`,
          }}
        />
        <div className="flex justify-between text-xs font-tabular text-ink-2">
          <span>{min.toFixed(2)}</span>
          <span>{max.toFixed(2)}</span>
        </div>
        <p className="muted small m-0">
          Natural Earth 110m · public domain · © IMS Atlas · atlas.aiserv.es
        </p>
      </div>
    </div>
  );
}

function ensureHatchPattern(map: MapLibreMap): void {
  if (map.hasImage("hatch-out")) return;
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#c8ccc8";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.stroke();
  const data = ctx.getImageData(0, 0, size, size);
  map.addImage(
    "hatch-out",
    { width: size, height: size, data: data.data },
    { pixelRatio: 1 },
  );
}

function applyColors(
  map: MapLibreMap,
  rows: ChoroplethDatum[],
  selected: string | undefined,
  origin: string | undefined,
  extrude: boolean,
): void {
  if (rows.length === 0) return;
  ensureHatchPattern(map);
  const analyzed = new Set(rows.map((r) => r.iso3));
  const scores = rows.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  const matchExpr: unknown[] = ["match", ["get", "ADM0_A3"]];
  for (const row of rows) {
    const t = (row.score - min) / span;
    matchExpr.push(row.iso3, scoreColor(t));
  }
  if (origin) matchExpr.push(origin, "#0f766e");
  matchExpr.push("#c8ccc8");
  map.setPaintProperty("countries-fill", "fill-color", matchExpr as never);

  const inAnalysis = [...analyzed, origin].filter(Boolean) as string[];
  map.setPaintProperty("countries-fill", "fill-opacity", [
    "case",
    ["in", ["get", "ADM0_A3"], ["literal", inAnalysis]],
    0.95,
    0.55,
  ] as never);

  if (!map.getLayer("countries-hatch")) {
    map.addLayer(
      {
        id: "countries-hatch",
        type: "fill",
        source: "ne",
        paint: {
          "fill-pattern": "hatch-out",
          "fill-opacity": 0.55,
        },
        filter: ["!", ["in", ["get", "ADM0_A3"], ["literal", inAnalysis]]],
      },
      "countries-line",
    );
  } else {
    map.setFilter("countries-hatch", [
      "!",
      ["in", ["get", "ADM0_A3"], ["literal", inAnalysis]],
    ] as never);
  }

  if (selected || origin) {
    map.setPaintProperty("countries-line", "line-width", [
      "case",
      ["==", ["get", "ADM0_A3"], selected ?? ""],
      2.4,
      ["==", ["get", "ADM0_A3"], origin ?? ""],
      2,
      0.4,
    ] as never);
  }

  if (extrude) {
    if (!map.getLayer("countries-extrusion")) {
      map.addLayer({
        id: "countries-extrusion",
        type: "fill-extrusion",
        source: "ne",
        paint: {
          "fill-extrusion-color": matchExpr as never,
          "fill-extrusion-height": 10000,
          "fill-extrusion-opacity": 0.85,
        },
      });
    }
    const heightExpr: unknown[] = ["match", ["get", "ADM0_A3"]];
    for (const row of rows) {
      const t = (row.score - min) / span;
      heightExpr.push(row.iso3, 20_000 + t * 280_000);
    }
    heightExpr.push(0);
    map.setPaintProperty(
      "countries-extrusion",
      "fill-extrusion-height",
      heightExpr as never,
    );
    map.setPaintProperty(
      "countries-extrusion",
      "fill-extrusion-color",
      matchExpr as never,
    );
  } else if (map.getLayer("countries-extrusion")) {
    map.removeLayer("countries-extrusion");
  }
}

function applyArcs(
  map: MapLibreMap,
  rows: ChoroplethDatum[],
  origin: string | undefined,
  topN: number,
): void {
  if (!origin || topN <= 0) return;
  const from = ISO_CENTROID[origin];
  if (!from) return;
  const top = [...rows].sort((a, b) => a.rank - b.rank).slice(0, topN);
  const vols = top.map((r) => r.imports ?? Math.max(1, 20 - r.rank));
  const vMax = Math.max(...vols, 1);
  const features = top
    .map((r) => {
      const to = ISO_CENTROID[r.iso3];
      if (!to) return null;
      const vol = r.imports ?? Math.max(1, 20 - r.rank);
      return {
        type: "Feature" as const,
        properties: {
          iso3: r.iso3,
          rank: r.rank,
          imports: vol,
          width: 1.2 + (3.8 * vol) / vMax,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: greatCircle(from, to),
        },
      };
    })
    .filter(Boolean);

  const data = {
    type: "FeatureCollection" as const,
    features: features as object[],
  };

  if (map.getSource("arcs")) {
    (map.getSource("arcs") as GeoJSONSource).setData(data as never);
  } else {
    map.addSource("arcs", { type: "geojson", data: data as never });
    map.addLayer({
      id: "arcs-line",
      type: "line",
      source: "arcs",
      paint: {
        "line-color": "#0f766e",
        "line-width": ["coalesce", ["get", "width"], 1.6],
        "line-opacity": 0.65,
      },
    });
  }
}
