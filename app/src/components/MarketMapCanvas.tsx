import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketEdge, MarketNode } from "@ims-atlas/core";
import { downloadDataUrl, downloadText } from "../cite/exportDownload";
import { dataConfig } from "../dataConfig";
import { composeChartPng, wrapSvgWithCredit } from "../export/imageExport";
import { useTranslation } from "../i18n";
import {
  CLUSTER_COLORS,
  collideLabels,
  makeSyntheticNodes,
  paintMarketMapFrame,
  sequentialColor,
  type LabelPos,
  type MapMode,
} from "../map/marketMapPaint";

export type { MapMode };

type Props = {
  nodes: MarketNode[];
  edges?: MarketEdge[];
  mode: MapMode;
  colorMode: "cluster" | "quadrant";
  overlayValues?: Record<string, number | null> | undefined;
  quadrants?: Record<string, number> | undefined;
  onSelect?: ((iso3: string) => void) | undefined;
  selected?: string | undefined;
  focusQuery?: string | undefined;
  showHulls?: boolean | undefined;
  clusterLabels?: Record<number, string> | undefined;
};

export function MarketMapCanvas({
  nodes,
  edges = [],
  mode,
  colorMode,
  overlayValues,
  quadrants,
  onSelect,
  selected,
  focusQuery = "",
  showHulls = false,
  clusterLabels,
}: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [lastFrameMs, setLastFrameMs] = useState(0);
  const [perf200Ms, setPerf200Ms] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const focusSet = useMemo(() => {
    const q = focusQuery.trim().toUpperCase();
    if (!q) return undefined;
    return new Set(nodes.filter((n) => n.iso3.includes(q)).map((n) => n.iso3));
  }, [focusQuery, nodes]);

  const layout = useMemo(() => {
    const W = 800;
    const H = 560;
    if (nodes.length === 0) {
      return { labels: [] as LabelPos[], W, H };
    }
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scores = nodes.map((n) => n.score);
    const sMin = Math.min(...scores);
    const sMax = Math.max(...scores);
    const sSpan = sMax - sMin || 1;
    const pad = 48;
    const raw: LabelPos[] = nodes.map((n) => {
      const x = pad + ((n.x - minX) / spanX) * (W - 2 * pad);
      const y = pad + (1 - (n.y - minY) / spanY) * (H - 2 * pad);
      const r = 6 + (18 * (n.score - sMin)) / sSpan;
      return { iso3: n.iso3, x, y, lx: x + r + 4, ly: y, r };
    });
    return { labels: collideLabels(raw), W, H };
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = layout.W * dpr;
    canvas.height = layout.H * dpr;
    canvas.style.width = `${layout.W}px`;
    canvas.style.height = `${layout.H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ms = paintMarketMapFrame(ctx, {
      W: layout.W,
      H: layout.H,
      labels: layout.labels,
      nodes,
      edges,
      mode,
      colorMode,
      view,
      ...(overlayValues ? { overlayValues } : {}),
      ...(quadrants ? { quadrants } : {}),
      ...(selected ? { selected } : {}),
      ...(focusSet ? { focusSet } : {}),
      showHulls,
      ...(clusterLabels ? { clusterLabels } : {}),
    });
    setLastFrameMs(ms);
  }, [
    layout,
    nodes,
    edges,
    view,
    mode,
    colorMode,
    overlayValues,
    quadrants,
    selected,
    focusSet,
    showHulls,
    clusterLabels,
  ]);

  useEffect(() => {
    if (!focusSet || focusSet.size !== 1) return;
    const only = [...focusSet][0]!;
    const lab = layout.labels.find((l) => l.iso3 === only);
    if (!lab) return;
    const targetScale = 1.8;
    setView({
      scale: targetScale,
      tx: layout.W / 2 - lab.x * targetScale,
      ty: layout.H / 2 - lab.y * targetScale,
    });
  }, [focusQuery, layout.labels, layout.W, layout.H, focusSet]);

  function exportPng(scale = 4) {
    const off = document.createElement("canvas");
    off.width = layout.W * scale;
    off.height = layout.H * scale;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    paintMarketMapFrame(ctx, {
      W: layout.W,
      H: layout.H,
      labels: layout.labels,
      nodes,
      edges,
      mode,
      colorMode,
      view: { scale: 1, tx: 0, ty: 0 },
      ...(overlayValues ? { overlayValues } : {}),
      ...(quadrants ? { quadrants } : {}),
      ...(selected ? { selected } : {}),
      ...(focusSet ? { focusSet } : {}),
      showHulls,
      ...(clusterLabels ? { clusterLabels } : {}),
    });
    const raw = off.toDataURL("image/png");
    void composeChartPng(
      raw,
      {
        title: "IMS Atlas market map",
        releaseId: dataConfig.release_version,
        extraCredit: "basemap / layout © IMS Atlas",
      },
      scale as 1 | 2 | 4,
    ).then((url) => downloadDataUrl("ims-atlas-market-map.png", url));
  }

  function exportSvg() {
    const W = layout.W;
    const H = layout.H;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
      `<rect width="100%" height="100%" fill="#f7f7f5"/>`,
    ];
    if (mode === "network") {
      const byIso = new Map(layout.labels.map((l) => [l.iso3, l]));
      for (const e of edges) {
        const a = byIso.get(e.source);
        const b = byIso.get(e.target);
        if (!a || !b) continue;
        parts.push(
          `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="#555" stroke-opacity="${(0.1 + 0.4 * e.weight).toFixed(3)}" stroke-width="${(0.6 + 1.4 * e.weight).toFixed(2)}"/>`,
        );
      }
    }
    for (const lab of layout.labels) {
      const node = nodes.find((n) => n.iso3 === lab.iso3)!;
      const q = quadrants?.[node.iso3] ?? node.cluster;
      const colorIdx =
        colorMode === "quadrant" ? (q - 1) % CLUSTER_COLORS.length : node.cluster;
      const color = CLUSTER_COLORS[colorIdx] ?? "#444";
      parts.push(
        `<circle cx="${lab.x.toFixed(2)}" cy="${lab.y.toFixed(2)}" r="${lab.r.toFixed(2)}" fill="${color}" fill-opacity="0.9"/>`,
      );
      parts.push(
        `<text x="${lab.lx.toFixed(2)}" y="${(lab.ly + 3).toFixed(2)}" font-size="11" font-family="sans-serif">${lab.iso3}</text>`,
      );
    }
    parts.push("</svg>");
    const credited = wrapSvgWithCredit(parts.join(""), {
      title: "IMS Atlas market map",
      releaseId: dataConfig.release_version,
      extraCredit: "basemap / layout © IMS Atlas",
    });
    downloadText("ims-atlas-market-map.svg", credited, "image/svg+xml");
  }

  function runPerf200() {
    const synth = makeSyntheticNodes(200, 7);
    const W = 800;
    const H = 560;
    const xs = synth.map((n) => n.x);
    const ys = synth.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scores = synth.map((n) => n.score);
    const sMin = Math.min(...scores);
    const sMax = Math.max(...scores);
    const sSpan = sMax - sMin || 1;
    const pad = 48;
    const labels: LabelPos[] = synth.map((n) => {
      const x = pad + ((n.x - minX) / spanX) * (W - 2 * pad);
      const y = pad + (1 - (n.y - minY) / spanY) * (H - 2 * pad);
      const r = 6 + (18 * (n.score - sMin)) / sSpan;
      return { iso3: n.iso3, x, y, lx: x + r + 4, ly: y, r };
    });
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    const ms = paintMarketMapFrame(ctx, {
      W,
      H,
      labels,
      nodes: synth,
      edges: [],
      mode: "network",
      colorMode: "cluster",
      view: { scale: 1, tx: 0, ty: 0 },
    });
    setPerf200Ms(ms);
  }

  return (
    <div
      className="market-map-wrap"
      data-testid="market-map"
      data-mode={mode}
      data-export-surface="chart"
    >
      <div
        className="market-map-toolbar export-menu"
        data-testid="export-menu-map"
        data-exportable="chart"
      >
        <button type="button" data-testid="export-map-png" onClick={() => exportPng(4)}>
          PNG 4×
        </button>
        <button type="button" data-testid="export-map-svg" onClick={exportSvg}>
          SVG
        </button>
        <button
          type="button"
          data-testid="map-reset-view"
          onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
        >
          {t("mapResetView")}
        </button>
        {import.meta.env.DEV ? (
          <>
            <button type="button" data-testid="map-perf-200" onClick={runPerf200}>
              Perf 200
            </button>
            <span className="muted small" data-testid="map-frame-ms">
              {lastFrameMs.toFixed(2)} ms
            </span>
            {perf200Ms !== null ? (
              <span className="muted small" data-testid="map-perf-ms">
                {perf200Ms.toFixed(2)}
              </span>
            ) : null}
          </>
        ) : null}
      </div>
      <canvas
        ref={canvasRef}
        data-testid="market-map-canvas"
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          setView((v) => ({
            ...v,
            scale: Math.min(4, Math.max(0.4, v.scale * factor)),
          }));
        }}
        onPointerDown={(e) => {
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            tx: view.tx,
            ty: view.ty,
          };
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setView({
            scale: view.scale,
            tx: drag.current.tx + (e.clientX - drag.current.x),
            ty: drag.current.ty + (e.clientY - drag.current.y),
          });
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          const moved =
            Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y);
          drag.current = null;
          if (moved > 4 || !onSelect || !canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const px = (e.clientX - rect.left - view.tx) / view.scale;
          const py = (e.clientY - rect.top - view.ty) / view.scale;
          let hit: string | undefined;
          let best = Infinity;
          for (const lab of layout.labels) {
            const d = Math.hypot(lab.x - px, lab.y - py);
            if (d < lab.r + 4 && d < best) {
              best = d;
              hit = lab.iso3;
            }
          }
          if (hit) onSelect(hit);
        }}
      />
      <ul className="map-legend" data-testid="map-legend">
        {mode === "overlay" ? (
          <li data-testid="legend-overlay">
            Overlay (low → high)
            <span
              className="swatch"
              style={{
                background: `linear-gradient(90deg, ${sequentialColor(0)}, ${sequentialColor(1)})`,
                width: 72,
              }}
            />
          </li>
        ) : mode === "density" ? (
          <li data-testid="legend-density">
            Density (score-weighted KDE)
            <span
              className="swatch"
              style={{
                background: `linear-gradient(90deg, ${sequentialColor(0)}, ${sequentialColor(1)})`,
                width: 72,
              }}
            />
          </li>
        ) : colorMode === "cluster" ? (
          Array.from(new Set(nodes.map((n) => n.cluster)))
            .sort((a, b) => a - b)
            .map((c) => (
              <li key={c}>
                <span
                  className="swatch"
                  style={{
                    background: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
                  }}
                />
                Cluster {c + 1}
              </li>
            ))
        ) : (
          [1, 2, 3, 4].map((q) => (
            <li key={q}>
              <span
                className="swatch"
                style={{
                  background: CLUSTER_COLORS[(q - 1) % CLUSTER_COLORS.length],
                }}
              />
              Q{q}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
