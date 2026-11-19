import { describe, expect, it } from "vitest";
import {
  normalizeDmp,
  normalizeImp,
  normalizeMinmax,
  normalizeRank,
  normalizeRatioLegacy,
  normalizeRobustZ,
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
    expect(Number.isNaN(out[2])).toBe(true);
    expect(Number.isNaN(out[3])).toBe(true);
  });

  it("DMP/IMP aliases match Jose names and support 0–5 scale", () => {
    expect(normalizeDmp([1, 2, 5], 5)).toEqual([1, 2, 5]);
    expect(normalizeImp([2, 4], 5)).toEqual([5, 2.5]);
  });

  it("minmax constant series mid", () => {
    expect(normalizeMinmax([3, 3, 3], "benefit")).toEqual([5, 5, 5]);
  });

  it("zscore flips for cost", () => {
    const b = normalizeZscore([1, 2, 3], "benefit");
    const c = normalizeZscore([1, 2, 3], "cost");
    expect(b[0]).toBeCloseTo(-c[0]!, 12);
  });

  it("rank average ties", () => {
    const out = normalizeRank([1, 1, 3], "benefit");
    expect(out[0]).toBeCloseTo(out[1]!, 12);
  });

  it("robust_z constant is zero and cost flips sign", () => {
    expect(normalizeRobustZ([4, 4, 4], "benefit")).toEqual([0, 0, 0]);
    const b = normalizeRobustZ([1, 2, 10], "benefit");
    const c = normalizeRobustZ([1, 2, 10], "cost");
    expect(b[0]).toBeCloseTo(-c[0]!, 12);
  });
});
