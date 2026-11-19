import { describe, expect, it } from "vitest";
import {
  normalizeMinmax,
  normalizeRank,
  normalizeRatioLegacy,
  normalizeZscore,
} from "./normalize.js";

describe("normalize", () => {
  it("ratio_legacy benefit scales by max*10", () => {
    expect(normalizeRatioLegacy([1, 2, 5], "benefit")).toEqual([2, 4, 10]);
  });

  it("ratio_legacy cost uses min/y*10 and NaN for non-positive", () => {
    const out = normalizeRatioLegacy([2, 4, 0, -1], "cost");
    expect(out[0]).toBe(10);
    expect(out[1]).toBe(5);
    expect(Number.isNaN(out[2]!)).toBe(true);
    expect(Number.isNaN(out[3]!)).toBe(true);
  });

  it("minmax maps constant columns to 5", () => {
    expect(normalizeMinmax([3, 3, 3], "benefit")).toEqual([5, 5, 5]);
  });

  it("zscore flips sign for cost", () => {
    const b = normalizeZscore([1, 2, 3], "benefit");
    const c = normalizeZscore([1, 2, 3], "cost");
    expect(c[0]).toBeCloseTo(-(b[0] as number), 12);
  });

  it("rank uses average ties scaled to (0,10]", () => {
    const out = normalizeRank([1, 1, 3], "benefit");
    expect(out[0]).toBeCloseTo(((1 + 2) / 2 / 3) * 10, 12);
    expect(out[2]).toBeCloseTo((3 / 3) * 10, 12);
  });
});
