import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** EXTRA-4: production app/src must not hard-code analysis year 2023. */
const ROOT = join(__dirname);
const ALLOW = new Set([
  "noHardcodedYear.test.ts",
  // Historical paper backtest copy may mention 2023 as a fact about the article.
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name.endsWith(".test.ts") ||
      name.endsWith(".test.tsx")
    ) {
      continue;
    }
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !ALLOW.has(name)) out.push(p);
  }
  return out;
}

describe("no hard-coded analysis year 2023 in app/src (EXTRA-4)", () => {
  it("avoids literal 2023 outside locales backtest strings and tests", () => {
    const files = walk(ROOT);
    const hits: string[] = [];
    for (const f of files) {
      const rel = f.slice(ROOT.length + 1);
      // Locales may still mention 2023 for published paper backtest facts.
      if (rel.startsWith("locales/")) continue;
      const text = readFileSync(f, "utf8");
      if (/\b2023\b/.test(text)) hits.push(rel);
    }
    expect(hits, `unexpected 2023 in: ${hits.join(", ")}`).toEqual([]);
  });
});
