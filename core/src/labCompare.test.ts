import { describe, expect, it } from "vitest";
import { compareRankings, topBottom } from "./labCompare.js";

describe("labCompare", () => {
  it("reports spearman and top-10 overlap", () => {
    const a = [
      { iso3: "A", score: 10, rank: 1 },
      { iso3: "B", score: 9, rank: 2 },
      { iso3: "C", score: 8, rank: 3 },
    ];
    const b = [
      { iso3: "A", score: 7, rank: 2 },
      { iso3: "B", score: 9, rank: 1 },
      { iso3: "C", score: 5, rank: 3 },
    ];
    const r = compareRankings(a, b, 2);
    expect(r.rankDelta.A).toBe(-1);
    expect(r.top10Overlap).toBe(1);
    expect(Number.isFinite(r.spearman)).toBe(true);
  });

  it("topBottom returns extremes", () => {
    const { top, bottom } = topBottom(["A", "B", "C"], [1, 9, 5], 1);
    expect(top[0]!.iso3).toBe("B");
    expect(bottom[0]!.iso3).toBe("A");
  });
});
