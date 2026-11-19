#!/usr/bin/env node
/**
 * Phase F: HEAD/GET every http(s) URL in catalog/sources.yaml.
 * Writes status/source_links.json. Exits 1 if a core World Bank URL fails.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const srcPath = join(root, "catalog/sources.yaml");
const outDir = join(root, "status");
const outPath = join(outDir, "source_links.json");

/** Must remain reachable for the open World Bank stack. */
const CORE = [
  "https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets",
  "https://lpi.worldbank.org/",
  "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
];

function extractUrls(text) {
  const urls = new Set();
  const re = /https?:\/\/[^\s"'<>]+/g;
  let m;
  while ((m = re.exec(text))) {
    let u = m[0].replace(/[),.;]+$/, "");
    if (u.includes("{")) continue; // endpoint templates
    urls.add(u);
  }
  return [...urls].sort();
}

async function probe(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  const headers = {
    "User-Agent": "IMS-Atlas-link-check/1.1 (+https://atlas.aiserv.es)",
  };
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers,
    });
    if (res.status === 405 || res.status === 403 || res.status === 400) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers,
      });
    }
    // 401/403 still prove the host is up (login walls).
    return {
      url,
      ok: res.ok || res.status === 401 || res.status === 403,
      status: res.status,
    };
  } catch (err) {
    return {
      url,
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(t);
  }
}

const text = await readFile(srcPath, "utf8");
const urls = extractUrls(text);
const results = [];
for (const url of urls) {
  results.push(await probe(url));
}
await mkdir(outDir, { recursive: true });
const summary = {
  checkedAt: new Date().toISOString(),
  n: results.length,
  ok: results.filter((r) => r.ok).length,
  fail: results.filter((r) => !r.ok).length,
  results,
};
await writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`source links: ${summary.ok}/${summary.n} ok → ${outPath}`);

const coreFails = CORE.filter((u) => {
  const row = results.find((r) => r.url === u);
  return !row || !row.ok;
});
if (coreFails.length) {
  console.error("CORE URL failures:", coreFails);
  process.exit(1);
}
