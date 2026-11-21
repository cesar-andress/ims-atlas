import { describe, expect, it } from "vitest";

/**
 * Contract tests for release-base cache keys (stale chapter bug).
 * Implementation lives in duckdbClient; we lock the key shape here so a
 * future edit cannot drop `base` from the slice key again.
 */
describe("DuckDB release chapter cache keys", () => {
  function productSliceKey(
    base: string,
    hs2: string,
    years: number[] | undefined,
    variableIds: string[] | undefined,
  ): string {
    return `${base}|${hs2}|y=${years?.join("-") ?? "*"}|v=${(variableIds ?? []).slice().sort().join(",") || "*"}`;
  }

  it("includes absolute release base so public↔internal switches invalidate", () => {
    const publicKey = productSliceKey(
      "https://atlas.aiserv.es/data/v1.1.0",
      "26",
      [2019, 2020, 2021, 2022, 2023, 2024],
      ["IMPV", "IMPC"],
    );
    const internalKey = productSliceKey(
      "https://atlas.aiserv.es/data/release/internal/v1.2.0",
      "26",
      [2019, 2020, 2021, 2022, 2023, 2024],
      ["IMPV", "IMPC"],
    );
    expect(publicKey).not.toBe(internalKey);
    expect(publicKey.startsWith("https://")).toBe(true);
    expect(internalKey).toContain("internal");
  });

  it("source file keeps base in the country-product slice key", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "duckdbClient.ts"),
      "utf8",
    );
    expect(src).toMatch(/sliceKey = `\$\{base\}\|\$\{key\}\|y=/);
    expect(src).toMatch(/countryProductKeys\.clear\(\)/);
  });
});
