#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(readFileSync(join(root, "config", "site.json"), "utf8"));
const domain = String(site.domain ?? "").trim();

if (!domain || domain === "UNKNOWN") {
  console.error(
    "config/site.json domain is UNKNOWN. Set it to your AISERV domain (e.g. aiser.v.example), then re-run make cname.",
  );
  process.exit(1);
}

const host = `atlas.${domain}`;
const outDir = join(root, "app", "public");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "CNAME"), `${host}\n`, "utf8");
console.log(`Wrote app/public/CNAME -> ${host}`);
