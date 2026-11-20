import { afterEach, describe, expect, it } from "vitest";
import {
  createDuckDbClient,
  createMemoryDataClient,
  getAtlasDataClient,
  resetAtlasDataClientForTests,
} from "./duckdbClient";

describe("memory data client", () => {
  it("filters country-year rows", async () => {
    const client = createMemoryDataClient([
      {
        iso3: "COL",
        year: 2019,
        variable_id: "IMPV",
        value: 1,
        flag_imputed: false,
        flag_locf: false,
      },
      {
        iso3: "PER",
        year: 2020,
        variable_id: "LPI",
        value: 2,
        flag_imputed: true,
        flag_locf: false,
      },
    ]);
    await client.init();
    const rows = await client.queryCountryYear({
      year: 2019,
      variableIds: ["IMPV"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.iso3).toBe("COL");
  });

  it("chapter loaders are stubbed", async () => {
    const client = createMemoryDataClient();
    await client.init();
    await expect(client.loadTradeChapter("64")).resolves.toBe(false);
    await expect(client.loadCountryProductChapter("15")).resolves.toBe(false);
    expect(client.tradeChapterUrl("64")).toBeUndefined();
  });
});

describe("getAtlasDataClient", () => {
  afterEach(() => {
    resetAtlasDataClientForTests();
  });

  it("returns a stable singleton", () => {
    const a = getAtlasDataClient();
    const b = getAtlasDataClient();
    expect(a).toBe(b);
  });

  it("createDuckDbClient still yields isolated instances", () => {
    const a = createDuckDbClient();
    const b = createDuckDbClient();
    expect(a).not.toBe(b);
    expect(a).not.toBe(getAtlasDataClient());
  });
});
