#!/usr/bin/env node
/**
 * Run Lighthouse against a local preview URL; write status/lighthouse.json.
 * Usage: node scripts/lighthouse-report.mjs http://127.0.0.1:4173/
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const url = process.argv[2] ?? "http://127.0.0.1:4173/";
const outDir = join(root, "status");
const reportPath = join(outDir, "lighthouse.json");

async function bundleSizes() {
  const assets = join(root, "app/dist/assets");
  const files = await readdir(assets);
  const rows = [];
  for (const name of files) {
    if (!/\.(js|css)$/.test(name)) continue;
    const s = await stat(join(assets, name));
    rows.push({ name, bytes: s.size });
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  return rows;
}

function runLighthouse() {
  return new Promise((resolve, reject) => {
    const args = [
      "lighthouse",
      url,
      "--quiet",
      "--chrome-flags=--headless --no-sandbox --disable-gpu",
      "--only-categories=performance,accessibility",
      "--output=json",
      `--output-path=${reportPath}`,
    ];
    const child = spawn("npx", ["--yes", ...args], {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`lighthouse exited ${code}`));
    });
  });
}

await mkdir(outDir, { recursive: true });
await runLighthouse();
const raw = JSON.parse(
  await (await import("node:fs/promises")).readFile(reportPath, "utf8"),
);
const perf = raw.categories?.performance?.score;
const a11y = raw.categories?.accessibility?.score;
const summary = {
  url,
  fetchedAt: new Date().toISOString(),
  scores: {
    performance: perf == null ? null : Math.round(perf * 100),
    accessibility: a11y == null ? null : Math.round(a11y * 100),
  },
  bundle: await bundleSizes(),
};
await writeFile(
  join(outDir, "phase12_perf.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(JSON.stringify(summary.scores, null, 2));
console.log("top bundles:", summary.bundle.slice(0, 8));
