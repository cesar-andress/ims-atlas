import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketNode } from "@ims-atlas/core";

const CLUSTER_COLORS = [
  "#0b5f4a",
  "#2a6f97",
  "#b85c38",
  "#6a4c93",
  "#bc4749",
  "#588157",
  "#0077b6",
  "#e9c46a",
];

type Props = {
  nodes: MarketNode[];
  colorMode: "cluster" | "quadrant";
  quadrants?: Record<string, number> | undefined;
  onSelect?: ((iso3: string) => void) | undefined;
  selected?: string | undefined;
};

type LabelPos = {
  iso3: string;
  x: number;
  y: number;
  lx: number;
  ly: number;
  r: number;
};

function collide(labels: LabelPos[], iterations = 40): LabelPos[] {
  const out = labels.map((l) => ({ ...l }));
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!;
        const b = out[j]!;
        const dx = a.lx - b.lx;
        const dy = a.ly - b.ly;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const min = 14;
        if (dist < min) {
          const push = ((min - dist) / dist) * 0.5;
          a.lx += dx * push;
          a.ly += dy * push;
          b.lx -= dx * push;
          b.ly -= dy * push;
        }
      }
    }
  }
  return out;
}

export function MarketMapCanvas({
  nodes,
  colorMode,
  quadrants,
  onSelect,
  selected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const layout = useMemo(() => {
    const W = 800;
    const H = 560;
    if (nodes.length === 0) {
      return { labels: [] as LabelPos[], scores: { min: 0, max: 1 }, W, H };
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
    return { labels: collide(raw), scores: { min: sMin, max: sMax }, W, H };
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
    ctx.clearRect(0, 0, layout.W, layout.H);
    ctx.save();
    ctx.translate(view.tx, view.ty);
    ctx.scale(view.scale, view.scale);

    // Soft links between same-cluster neighbours (kNN-ish visual)
    ctx.strokeStyle = "rgba(100,100,100,0.15)";
    ctx.lineWidth = 1 / view.scale;
    for (let i = 0; i < nodes.length; i++) {
      let bestJ = -1;
      let bestD = Infinity;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        if (nodes[i]!.cluster !== nodes[j]!.cluster) continue;
        const dx = nodes[i]!.x - nodes[j]!.x;
        const dy = nodes[i]!.y - nodes[j]!.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          bestJ = j;
        }
      }
      if (bestJ < 0) continue;
      const a = layout.labels.find((l) => l.iso3 === nodes[i]!.iso3);
      const b = layout.labels.find((l) => l.iso3 === nodes[bestJ]!.iso3);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const lab of layout.labels) {
      const node = nodes.find((n) => n.iso3 === lab.iso3)!;
      const q = quadrants?.[node.iso3] ?? node.cluster;
      const colorIdx =
        colorMode === "quadrant" ? (q - 1) % CLUSTER_COLORS.length : node.cluster;
      const color = CLUSTER_COLORS[colorIdx] ?? "#444";
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = selected && selected !== lab.iso3 ? 0.35 : 0.9;
      ctx.arc(lab.x, lab.y, lab.r, 0, Math.PI * 2);
      ctx.fill();
      if (selected === lab.iso3) {
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2 / view.scale;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#1a1a1a";
      ctx.font = `${11 / view.scale}px "IBM Plex Sans", sans-serif`;
      ctx.fillText(lab.iso3, lab.lx, lab.ly + 3);
    }
    ctx.restore();
  }, [layout, nodes, view, colorMode, quadrants, selected]);

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "ims-atlas-market-map.png";
    a.click();
  }

  function exportSvg() {
    const W = layout.W ?? 800;
    const H = layout.H ?? 560;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
      `<rect width="100%" height="100%" fill="#f7f7f5"/>`,
    ];
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
    const blob = new Blob([parts.join("")], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ims-atlas-market-map.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="market-map-wrap" data-testid="market-map">
      <div className="market-map-toolbar">
        <button type="button" data-testid="export-map-png" onClick={exportPng}>
          PNG
        </button>
        <button type="button" data-testid="export-map-svg" onClick={exportSvg}>
          SVG
        </button>
        <button type="button" onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}>
          Reset
        </button>
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
          drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
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
      <svg ref={svgRef} className="visually-hidden" aria-hidden />
      <ul className="map-legend" data-testid="map-legend">
        {colorMode === "cluster"
          ? Array.from(new Set(nodes.map((n) => n.cluster)))
              .sort((a, b) => a - b)
              .map((c) => (
                <li key={c}>
                  <span
                    className="swatch"
                    style={{ background: CLUSTER_COLORS[c % CLUSTER_COLORS.length] }}
                  />
                  Cluster {c + 1}
                </li>
              ))
          : [1, 2, 3, 4].map((q) => (
              <li key={q}>
                <span
                  className="swatch"
                  style={{
                    background: CLUSTER_COLORS[(q - 1) % CLUSTER_COLORS.length],
                  }}
                />
                Q{q}
              </li>
            ))}
      </ul>
    </div>
  );
}
