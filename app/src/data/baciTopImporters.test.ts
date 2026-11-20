import { afterEach, describe, expect, it } from "vitest";
import { setBaciImportCache } from "./baciImportCache";
import { loadBaciTopImporters } from "./baciTopImporters";
import { createMemoryDataClient } from "./duckdbClient";

describe("loadBaciTopImporters", () => {
  afterEach(() => {
    setBaciImportCache(null);
  });

  it("refuses HS4/HS6 without collapsing to HS2", async () => {
    const r = await loadBaciTopImporters(
      { hs: "6401", year: 2022 },
      createMemoryDataClient(),
    );
    expect(r.source).toBe("unavailable");
    expect(r.top).toEqual([]);
  });

  it("returns cache hit without touching DuckDB when volumes match", async () => {
    setBaciImportCache({
      hs2: "64",
      year: 2022,
      volumes: { USA: 100, CHN: 50, DEU: 10 },
      source: "baci_release",
    });
    const client = createMemoryDataClient();
    const r = await loadBaciTopImporters(
      { hs: "64", year: 2022, topN: 2 },
      client,
    );
    expect(r.source).toBe("baci_release");
    expect(r.top.map((x) => x.iso3)).toEqual(["USA", "CHN"]);
  });

  it("marks unavailable when memory client has no trade chapter", async () => {
    const r = await loadBaciTopImporters(
      { hs: "64", year: 2022 },
      createMemoryDataClient(),
    );
    expect(r.source).toBe("unavailable");
  });
});
