import { describe, expect, it } from "vitest";
import {
  displayWeightPercents,
  setOneWeight,
  weightsDisplayOk,
} from "./criterionWeights";

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe("setOneWeight", () => {
  it("keeps the dragged criterion exact and the total at 1", () => {
    const out = setOneWeight({ a: 0.5, b: 0.3, c: 0.2 }, "a", 0.8);
    expect(out.a).toBeCloseTo(0.8, 12);
    expect(sum(out)).toBeCloseTo(1, 12);
  });

  it("rescales the others proportionally", () => {
    const out = setOneWeight({ a: 0.5, b: 0.3, c: 0.2 }, "a", 0.2);
    expect(out.b! / out.c!).toBeCloseTo(0.3 / 0.2, 12);
  });

  it("splits the remainder equally when the others are all zero", () => {
    const out = setOneWeight({ a: 1, b: 0, c: 0 }, "a", 0.4);
    expect(out.b).toBeCloseTo(0.3, 12);
    expect(out.c).toBeCloseTo(0.3, 12);
  });

  it("ignores unknown keys and clamps the share", () => {
    const w = { a: 0.5, b: 0.5 };
    expect(setOneWeight(w, "zzz", 0.3)).toBe(w);
    expect(setOneWeight(w, "a", 3).a).toBe(1);
  });
});

describe("displayWeightPercents", () => {
  it("sums to exactly 100 for active criteria", () => {
    const w = { a: 1 / 3, b: 1 / 3, c: 1 / 3 };
    const pct = displayWeightPercents(w, { a: 2, b: 1, c: 3 });
    expect(sum(pct)).toBe(100);
    expect(weightsDisplayOk(w, { a: 2, b: 1, c: 3 })).toBe(true);
  });

  it("zeros criteria with no used variables", () => {
    const pct = displayWeightPercents({ a: 0.5, b: 0.5, c: 0.2 }, { a: 2, b: 0, c: 1 });
    expect(pct.b).toBe(0);
    expect(pct.a! + pct.c!).toBe(100);
  });
});
