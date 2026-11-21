import { describe, expect, it } from "vitest";
import { createMemoryDataClient, type AtlasDataClient } from "./duckdbClient";
import { loadVariableCountryYears } from "./loadVariableCountryYears";

describe("loadVariableCountryYears", () => {
  it("returns country_year years from the release client", async () => {
    const base = createMemoryDataClient([
      {
        iso3: "ESP",
        year: 2018,
        variable_id: "GII",
        value: 1,
        flag_imputed: false,
        flag_locf: false,
      },
      {
        iso3: "ESP",
        year: 2020,
        variable_id: "GII",
        value: 2,
        flag_imputed: false,
        flag_locf: false,
      },
      {
        iso3: "FRA",
        year: 2019,
        variable_id: "GII",
        value: 3,
        flag_imputed: false,
        flag_locf: false,
      },
    ]);
    const client: AtlasDataClient = {
      getStatus: () => base.getStatus(),
      getError: () => base.getError(),
      init: () => base.init(),
      loadRelease: () => base.loadRelease(),
      loadTradeChapter: (hs2) => base.loadTradeChapter(hs2),
      loadCountryProductChapter: (...args) =>
        base.loadCountryProductChapter(...args),
      tradeChapterUrl: (hs2) => base.tradeChapterUrl(hs2),
      queryCountryYear: (opts) => base.queryCountryYear(opts),
      async querySql(sql: string) {
        const rows = await base.querySql(sql);
        if (sql.includes("iso3 = 'ESP'") && sql.includes("GII")) {
          return rows.filter(
            (r) =>
              String(r.iso3) === "ESP" && String(r.variable_id) === "GII",
          );
        }
        if (sql.includes("LIMIT 1") && sql.includes("GII")) {
          return [{ hit: 1 }];
        }
        return rows;
      },
    };
    const result = await loadVariableCountryYears({
      variableId: "GII",
      iso3: "ESP",
      client,
    });
    expect(result).toEqual({
      status: "ok",
      years: [2018, 2020],
      panel: "country_year",
    });
  });

  it("requires HS for product variables and rejects bilateral", async () => {
    const client = createMemoryDataClient([]);
    await expect(
      loadVariableCountryYears({
        variableId: "IMPV",
        iso3: "COL",
        client,
      }),
    ).resolves.toEqual({ status: "unavailable", reason: "needs_hs" });

    await expect(
      loadVariableCountryYears({
        variableId: "DIST",
        iso3: "COL",
        hs: "64",
        client,
      }),
    ).resolves.toEqual({ status: "unavailable", reason: "bilateral" });
  });
});
