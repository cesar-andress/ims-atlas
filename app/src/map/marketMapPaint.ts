import type { MarketEdge, MarketNode } from "@ims-atlas/core";

export type MapMode = "network" | "overlay" | "density";

export type LabelPos = {
  iso3: string;
  x: number;
  y: number;
  lx: number;
  ly: number;
  r: number;
};

export const CLUSTER_COLORS = [
  "#0b5f4a",
  "#2a6f97",
  "#b85c38",
  "#6a4c93",
  "#bc4749",
  "#588157",
  "#0077b6",
  "#e9c46a",
];

/** Blue→yellow sequential scale for overlay / density. */
export function sequentialColor(t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(20 + 220 * u);
  const g = Math.round(60 + 160 * u);
  const b = Math.round(160 - 120 * u);
  return `rgb(${r},${g},${b})`;
}

export function collideLabels(labels: LabelPos[], iterations = 40): LabelPos[] {
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

/**
 * Paint one frame. Used by the canvas UI and CI frame-budget tests.
 * Returns elapsed ms for the paint path.
 */
export function paintMarketMapFrame(
  ctx: CanvasRenderingContext2D,
  opts: {
    W: number;
    H: number;
    labels: LabelPos[];
    nodes: MarketNode[];
    edges: MarketEdge[];
    mode: MapMode;
    colorMode: "cluster" | "quadrant";
    overlayValues?: Record<string, number | null>;
    quadrants?: Record<string, number>;
    selected?: string;
    focusSet?: Set<string>;
    view: { scale: number; tx: number; ty: number };
    showHulls?: boolean;
    /** Cluster id → short characterisation (e.g. top factors). */
    clusterLabels?: Record<number, string>;
  },
): number {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const {
    W,
    H,
    labels,
    nodes,
    edges,
    mode,
    colorMode,
    overlayValues,
    quadrants,
    selected,
    showHulls,
    focusSet,
    view,
  } = opts;

  if (nodes.length === 0) {
    ctx.clearRect(0, 0, W, H);
    return 0;
  }

  const byIso = new Map(labels.map((l) => [l.iso3, l]));
  const overlayNums = nodes
    .map((n) => overlayValues?.[n.iso3])
    .filter((v): v is number => typeof v === "number");
  const oMin = overlayNums.length ? Math.min(...overlayNums) : 0;
  const oMax = overlayNums.length ? Math.max(...overlayNums) : 1;
  const oSpan = oMax - oMin || 1;
  const scoreMin = Math.min(...nodes.map((n) => n.score));
  const scoreMax = Math.max(...nodes.map((n) => n.score));
  const scoreSpan = scoreMax - scoreMin || 1;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#f7f7f5";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(view.tx, view.ty);
  ctx.scale(view.scale, view.scale);

  if (mode === "density") {
    const cell = 8;
    const gw = Math.ceil(W / cell);
    const gh = Math.ceil(H / cell);
    const grid = new Float64Array(gw * gh);
    let gMax = 0;
    for (const lab of labels) {
      const node = nodes.find((n) => n.iso3 === lab.iso3)!;
      const w = 0.2 + (node.score - scoreMin) / scoreSpan;
      const sigma = 28;
      const r = Math.ceil(sigma * 2.5);
      const x0 = Math.max(0, Math.floor((lab.x - r) / cell));
      const x1 = Math.min(gw - 1, Math.ceil((lab.x + r) / cell));
      const y0 = Math.max(0, Math.floor((lab.y - r) / cell));
      const y1 = Math.min(gh - 1, Math.ceil((lab.y + r) / cell));
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          const cx = (gx + 0.5) * cell;
          const cy = (gy + 0.5) * cell;
          const d2 = (cx - lab.x) ** 2 + (cy - lab.y) ** 2;
          const v = w * Math.exp(-d2 / (2 * sigma * sigma));
          const idx = gy * gw + gx;
          grid[idx]! += v;
          if (grid[idx]! > gMax) gMax = grid[idx]!;
        }
      }
    }
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const v = grid[gy * gw + gx]! / (gMax || 1);
        if (v < 0.02) continue;
        ctx.fillStyle = sequentialColor(v);
        ctx.globalAlpha = 0.55 * Math.min(1, v * 1.2);
        ctx.fillRect(gx * cell, gy * cell, cell + 0.5, cell + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  if (showHulls && mode === "network") {
    const byCluster = new Map<number, LabelPos[]>();
    for (const lab of labels) {
      const node = nodes.find((n) => n.iso3 === lab.iso3);
      if (!node) continue;
      const c =
        colorMode === "quadrant"
          ? (quadrants?.[node.iso3] ?? node.cluster)
          : node.cluster;
      const arr = byCluster.get(c) ?? [];
      arr.push(lab);
      byCluster.set(c, arr);
    }
    for (const [c, pts] of byCluster) {
      if (pts.length < 3) continue;
      const hull = convexHull(pts.map((p) => ({ x: p.x, y: p.y })));
      if (hull.length < 3) continue;
      const color = CLUSTER_COLORS[c % CLUSTER_COLORS.length] ?? "#444";
      ctx.beginPath();
      ctx.moveTo(hull[0]!.x, hull[0]!.y);
      for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i]!.x, hull[i]!.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.12;
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2 / view.scale;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
      const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
      ctx.fillStyle = color;
      ctx.font = `bold ${12 / view.scale}px Inter, sans-serif`;
      const label =
        opts.clusterLabels?.[c] !== undefined
          ? `C${c}: ${opts.clusterLabels[c]}`
          : `C${c}`;
      ctx.fillText(label, cx, cy);
    }
  }

  if (mode === "network" && edges.length > 0) {
    for (const e of edges) {
      const a = byIso.get(e.source);
      const b = byIso.get(e.target);
      if (!a || !b) continue;
      ctx.strokeStyle = `rgba(80,80,80,${0.08 + 0.35 * e.weight})`;
      ctx.lineWidth = (0.6 + 1.4 * e.weight) / view.scale;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  for (const lab of labels) {
    const node = nodes.find((n) => n.iso3 === lab.iso3)!;
    const focused = !focusSet || focusSet.size === 0 || focusSet.has(lab.iso3);
    let color: string;
    if (mode === "overlay") {
      const raw = overlayValues?.[lab.iso3];
      color =
        typeof raw === "number" ? sequentialColor((raw - oMin) / oSpan) : "#bbbbbb";
    } else if (mode === "density") {
      color = sequentialColor((node.score - scoreMin) / scoreSpan);
    } else {
      const q = quadrants?.[node.iso3] ?? node.cluster;
      const colorIdx =
        colorMode === "quadrant" ? (q - 1) % CLUSTER_COLORS.length : node.cluster;
      color = CLUSTER_COLORS[colorIdx] ?? "#444";
    }

    ctx.beginPath();
    ctx.fillStyle = color;
    const dim =
      (!focused ? 0.15 : 1) *
      (selected && selected !== lab.iso3 ? 0.35 : mode === "density" ? 0.75 : 0.9);
    ctx.globalAlpha = dim;
    ctx.arc(lab.x, lab.y, lab.r, 0, Math.PI * 2);
    ctx.fill();
    if (
      selected === lab.iso3 ||
      (focusSet && focusSet.has(lab.iso3) && focusSet.size === 1)
    ) {
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2 / view.scale;
      ctx.stroke();
    }
    ctx.globalAlpha = focused ? 1 : 0.25;
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `${11 / view.scale}px "IBM Plex Sans", sans-serif`;
    ctx.fillText(lab.iso3, lab.lx, lab.ly + 3);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return t1 - t0;
}

/** Monotone-chain convex hull for cluster fills. */
export function convexHull(
  points: { x: number; y: number }[],
): { x: number; y: number }[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 1) return pts;
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Synthetic layout for CI frame-budget (200+ nodes). */
export function makeSyntheticNodes(n: number, seed = 1): MarketNode[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const nodes: MarketNode[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({
      iso3: `N${i.toString(36).toUpperCase().padStart(3, "0")}`,
      x: rand() * 2 - 1,
      y: rand() * 2 - 1,
      score: rand(),
      rank: i + 1,
      cluster: i % 6,
    });
  }
  return nodes;
}
