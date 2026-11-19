#!/usr/bin/env node
/**
 * Capture fixed-viewport screenshots for the software paper into ../../paper-figures/.
 * Directory is gitignored; skip commit if total size > 5 MB.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const outDir = join(appRoot, "..", "paper-figures");
const port = 4174;
const baseURL = `http://127.0.0.1:${port}`;

function encodeConfig(config) {
  return Buffer.from(JSON.stringify(config), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const base = {
  v: 1,
  origin: "COL",
  year: 2023,
  hs: "64",
  normalization: "minmax",
  mcdm: "wsm",
  weightScheme: "expert_mean",
  missingThreshold: 0.2,
  mapSeed: 42,
  lang: "en",
};

const shots = [
  { name: "01-ranking", view: "ranking", testId: "ranking-view" },
  { name: "02-matrix", view: "matrix", testId: "matrix-view" },
  { name: "03-map", view: "map", testId: "map-view" },
  { name: "04-uncertainty", view: "uncertainty", testId: "uncertainty-view" },
  { name: "05-backtest", view: "backtest", testId: "backtest-view" },
  { name: "06-time", view: "time", testId: "time-view" },
  { name: "07-docs", view: "docs", testId: "docs-view" },
];

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server not ready: ${url}`);
}

function startPreview() {
  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { cwd: appRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  return child;
}

async function totalBytes(dir) {
  let sum = 0;
  for (const name of await readdir(dir)) {
    sum += (await stat(join(dir, name))).size;
  }
  return sum;
}

await mkdir(outDir, { recursive: true });
const preview = startPreview();
preview.stderr.on("data", () => {});
preview.stdout.on("data", () => {});
await waitForServer(baseURL);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  for (const shot of shots) {
    const url = `${baseURL}/${shot.view}?c=${encodeConfig({ ...base, view: shot.view })}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByTestId(shot.testId).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    const path = join(outDir, `${shot.name}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log("wrote", path);
  }
  const manifest = {
    createdAt: new Date().toISOString(),
    viewport: { width: 1280, height: 800 },
    shots: shots.map((s) => s.name),
  };
  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const bytes = await totalBytes(outDir);
  console.log(`paper-figures total ${(bytes / (1024 * 1024)).toFixed(2)} MiB`);
  if (bytes > 5 * 1024 * 1024) {
    console.warn(
      "WARNING: paper-figures exceeds 5 MiB — do not commit (already gitignored).",
    );
  }
} finally {
  await browser.close();
  preview.kill("SIGTERM");
}
