#!/usr/bin/env node
/**
 * Rewrite etl/pyproject.toml optional backtest extra to pin ims-backtest at a git tag.
 * Never pins a branch.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config", "ims-backtest.json"), "utf8"));
const tag = String(cfg.tag ?? "").trim();
const repo = String(cfg.repository ?? "").trim();

if (!tag || tag === "UNKNOWN") {
  console.error(
    "config/ims-backtest.json tag is UNKNOWN. Create a release tag on ims-backtest, set it here, then re-run make pin-backtest.",
  );
  process.exit(1);
}
if (!repo) {
  console.error("config/ims-backtest.json repository is missing.");
  process.exit(1);
}

const dep = `ims-backtest @ git+${repo}@${tag}`;
const pyprojectPath = join(root, "etl", "pyproject.toml");
let text = readFileSync(pyprojectPath, "utf8");

const block = `[project.optional-dependencies]\n# Populated by \`make pin-backtest\` once config/ims-backtest.json has a real tag.\n# Never pin to a branch.\nbacktest = [\n  "${dep}",\n]\n`;

if (!text.includes("[project.optional-dependencies]")) {
  console.error("etl/pyproject.toml missing [project.optional-dependencies]");
  process.exit(1);
}

text = text.replace(/\[project\.optional-dependencies\][\s\S]*?(?=\n\[|$)/, block);
writeFileSync(pyprojectPath, text, "utf8");
console.log(`Pinned optional extra backtest -> ${dep}`);
console.log("Next: cd etl && uv sync --extra backtest");
