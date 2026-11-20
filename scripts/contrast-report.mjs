/**
 * WCAG contrast report for design tokens (light + dark).
 * Writes status/contrast.json. Exit 1 if any pair < 4.5:1 (body text).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relLuminance({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = f(r);
  const G = f(g);
  const B = f(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a, b) {
  const L1 = relLuminance(hexToRgb(a));
  const L2 = relLuminance(hexToRgb(b));
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  light: {
    ink: "#0f172a",
    "ink-2": "#475569",
    surface: "#ffffff",
    ground: "#f4f6f8",
    primary: "#0f766e",
    "primary-ink": "#0f5f58",
  },
  dark: {
    ink: "#f8fafc",
    "ink-2": "#cbd5e1",
    surface: "#111827",
    ground: "#0b1220",
    primary: "#2dd4bf",
    "primary-ink": "#99f6e4",
  },
};

const pairs = [
  ["ink", "surface"],
  ["ink", "ground"],
  ["ink-2", "surface"],
  ["ink-2", "ground"],
  ["primary-ink", "surface"],
  ["primary", "surface"],
];

const rows = [];
let worst = Infinity;
for (const [theme, colors] of Object.entries(themes)) {
  for (const [fg, bg] of pairs) {
    const ratio = contrast(colors[fg], colors[bg]);
    worst = Math.min(worst, ratio);
    rows.push({
      theme,
      fg,
      bg,
      ratio: Math.round(ratio * 100) / 100,
      pass_aa_normal: ratio >= 4.5,
    });
  }
}

const report = {
  generated_at: new Date().toISOString(),
  threshold: 4.5,
  worst_ratio: Math.round(worst * 100) / 100,
  pass: rows.every((r) => r.pass_aa_normal),
  pairs: rows,
};

const outDir = join(root, "status");
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "contrast.json"), JSON.stringify(report, null, 2) + "\n");
const pub = join(root, "app/public/status");
await mkdir(pub, { recursive: true });
await writeFile(join(pub, "contrast.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ pass: report.pass, worst: report.worst_ratio }, null, 2));
if (!report.pass) process.exit(1);
