import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules") continue;
      out.push(...walkTs(p));
    } else if (/\.(tsx?)$/.test(name.name) && !name.name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

describe("Prompt 4e guards", () => {
  it("JOSE_DEFAULT_INPUT only in the Jose preset helper", () => {
    const offenders: string[] = [];
    for (const file of walkTs(SRC)) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("JOSE_DEFAULT_INPUT")) continue;
      const rel = file.slice(SRC.length + 1);
      if (rel === "data/incotermsForm.ts") continue;
      offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("never hardcodes delay cost 75 €/day", () => {
    const offenders: string[] = [];
    for (const file of walkTs(SRC)) {
      const text = readFileSync(file, "utf8");
      if (/delayDays\s*\*\s*75|\*\s*75\s*\/\/.*demurr|75\s*\*\s*delayDays/.test(text)) {
        offenders.push(file.slice(SRC.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
