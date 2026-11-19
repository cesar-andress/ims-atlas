#!/usr/bin/env node
/**
 * Phase F: fail if hashed entry chunks exceed budgets (bytes, uncompressed).
 * Requires app/dist from a prior build.
 */
import { readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const assets = join(root, "app/dist/assets");
const outDir = join(root, "status");

/** Soft ceilings — MapLibre/ECharts stay lazy-loaded. */
const BUDGETS = [
  { match: /^maplibre-.*\.js$/, max: 900_000, label: "maplibre" },
  { match: /^echarts-.*\.js$/, max: 600_000, label: "echarts" },
  { match: /^react-vendor-.*\.js$/, max: 220_000, label: "react-vendor" },
  { match: /^duckdb-.*\.js$/, max: 250_000, label: "duckdb" },
  { match: /^index-.*\.js$/, max: 130_000, label: "app-shell" },
  { match: /^core-.*\.js$/, max: 40_000, label: "core" },
];

const files = await readdir(assets);
const sizes = [];
for (const name of files) {
  if (!/\.(js|css)$/.test(name)) continue;
  const s = await stat(join(assets, name));
  sizes.push({ name, bytes: s.size });
}
sizes.sort((a, b) => b.bytes - a.bytes);

const violations = [];
for (const b of BUDGETS) {
  const hit = sizes.find((f) => b.match.test(f.name));
  if (!hit) {
    violations.push({ label: b.label, error: "missing chunk" });
    continue;
  }
  if (hit.bytes > b.max) {
    violations.push({
      label: b.label,
      name: hit.name,
      bytes: hit.bytes,
      max: b.max,
    });
  }
}

await mkdir(outDir, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  budgets: BUDGETS.map((b) => ({ label: b.label, max: b.max })),
  top: sizes.slice(0, 12),
  violations,
};
await writeFile(
  join(outDir, "bundle_budgets.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

if (violations.length) {
  console.error("bundle budget violations:", violations);
  process.exit(1);
}
console.log("bundle budgets ok; top:", sizes.slice(0, 5));
