import { useEffect, useRef } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** Natural Earth 110m admin-0 countries (public domain) via jsDelivr. */
export const NE_GEOJSON_URL =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_110m_admin_0_countries.geojson";

/** ISO_A3 keyed scores for choropleth fill. */
export type ChoroplethDatum = { iso3: string; score: number; rank: number };

type Props = {
  rows: ChoroplethDatum[];
  selected?: string | undefined;
  onSelect?: ((iso3: string) => void) | undefined;
};

function scoreColor(t: number): string {
  // green → yellow → muted (t in [0,1], higher = better)
  const r = Math.round(20 + (220 - 20) * (1 - t));
  const g = Math.round(95 + (180 - 95) * t);
  const b = Math.round(74 + (40 - 74) * (1 - t));
  return `rgb(${r},${g},${b})`;
}

/**
 * MapLibre choropleth. Uses Natural Earth via world-atlas TopoJSON served as
 * GeoJSON countries-110m from jsDelivr (Natural Earth: public domain).
 * Licence note must remain visible in the parent view.
 */
export function WorldChoropleth({ rows, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          ne: {
            type: "geojson",
            data: NE_GEOJSON_URL,
          },
        },
        layers: [
          {
            id: "bg",
            type: "background",
            paint: { "background-color": "#e8ebe8" },
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
      zoom: 1.2,
      attributionControl: {},
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.on("load", () => {
      applyColors(map, rowsRef.current, selected);
    });

    map.on("click", "countries-fill", (e) => {
      const f = e.features?.[0];
      const iso =
        (f?.properties?.ADM0_A3 as string | undefined) ??
        (f?.properties?.ISO_A3 as string | undefined);
      if (iso && onSelect) onSelect(iso);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyColors(map, rows, selected);
  }, [rows, selected]);

  return (
    <div
      className="choropleth"
      data-testid="world-choropleth"
      ref={containerRef}
      role="img"
      aria-label="World choropleth of ranking scores"
    />
  );
}

function applyColors(
  map: MapLibreMap,
  rows: ChoroplethDatum[],
  selected: string | undefined,
): void {
  if (rows.length === 0) return;
  const scores = rows.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  const matchExpr: unknown[] = ["match", ["get", "ADM0_A3"]];
  for (const row of rows) {
    const t = (row.score - min) / span;
    matchExpr.push(row.iso3, scoreColor(t));
  }
  matchExpr.push("#c8ccc8");
  map.setPaintProperty("countries-fill", "fill-color", matchExpr as never);

  if (selected) {
    map.setPaintProperty("countries-line", "line-width", [
      "case",
      ["==", ["get", "ADM0_A3"], selected],
      2.2,
      0.4,
    ] as never);
  }
}
