import { describe, expect, it } from "vitest";
import { preselectMarkets } from "./preselection.js";

describe("preselectMarkets", () => {
  const rows = [
    { iso3: "usa", importValue: 50 },
    { iso3: "deu", importValue: 30 },
    { iso3: "fra", importValue: 20 },
    { iso3: "zzz", importValue: 0 },
  ];

  it("top_n funnel reports removals", () => {
    const r = preselectMarkets({ rows, mode: "top_n", topN: 2 });
    expect(r.importers).toEqual(["USA", "DEU", "FRA"]);
    expect(r.selected).toEqual(["USA", "DEU"]);
    expect(r.effects[0]!.removed).toContain("ZZZ");
    expect(r.effects[1]!.removed).toEqual(["FRA"]);
    expect(r.shareByIso.USA).toBeCloseTo(0.5, 12);
  });

  it("cumulative_share stops at threshold", () => {
    const r = preselectMarkets({
      rows,
      mode: "cumulative_share",
      cumulativeShare: 0.8,
    });
    expect(r.selected).toEqual(["USA", "DEU"]);
    expect(r.cumulativeShare.DEU).toBeCloseTo(0.8, 12);
  });

  it("manual add/remove are explicit", () => {
    const r = preselectMarkets({
      rows,
      mode: "top_n",
      topN: 1,
      manualAdd: ["FRA"],
      manualRemove: ["USA"],
    });
    expect(r.selected).toEqual(["FRA"]);
    expect(r.manualRemoved).toEqual(["USA"]);
    expect(r.manualAdded).toEqual(["FRA"]);
  });
});
