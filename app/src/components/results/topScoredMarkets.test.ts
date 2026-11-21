import { describe, expect, it } from "vitest";
import { topScoredMarkets } from "./topScoredMarkets";

describe("topScoredMarkets", () => {
  it("omits null/NaN scores from the narrative top-N", () => {
    const ranking = [
      { iso3: "ABW", score: Number.NaN, rank: 1 },
      { iso3: "AFG", score: Number.NaN, rank: 2 },
      { iso3: "AGO", score: 0.6, rank: 3 },
      { iso3: "ARE", score: 1.9, rank: 4 },
      { iso3: "ARM", score: 2.09, rank: 5 },
    ];
    const fixedOrder = [
      { iso3: "ARM", score: 2.09, rank: 1 },
      { iso3: "ARE", score: 1.9, rank: 2 },
      { iso3: "AGO", score: 0.6, rank: 3 },
      { iso3: "ABW", score: Number.NaN, rank: 4 },
      { iso3: "AFG", score: Number.NaN, rank: 5 },
    ];
    expect(topScoredMarkets(fixedOrder, 3).map((r) => r.iso3)).toEqual([
      "ARM",
      "ARE",
      "AGO",
    ]);
    expect(topScoredMarkets(ranking, 3).map((r) => r.iso3)).toEqual([
      "AGO",
      "ARE",
      "ARM",
    ]);
    expect(topScoredMarkets(ranking, 3).every((r) => Number.isFinite(r.score))).toBe(
      true,
    );
  });
});
