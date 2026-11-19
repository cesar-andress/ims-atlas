import { describe, expect, it } from "vitest";
import { aggregatePairwiseGeometric, ahpFromPairwise } from "./ahp.js";

describe("ahp", () => {
  it("recovers equal weights for all-ones matrix", () => {
    const m = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    const r = ahpFromPairwise(m);
    expect(r.weights[0]).toBeCloseTo(1 / 3, 9);
    expect(r.cr).toBeLessThan(0.01);
  });

  it("flags high CR on inconsistent matrix", () => {
    const m = [
      [1, 9, 1 / 9],
      [1 / 9, 1, 9],
      [9, 1 / 9, 1],
    ];
    const r = ahpFromPairwise(m);
    expect(r.cr).toBeGreaterThan(0.1);
    expect(r.mostInconsistent).toBeDefined();
  });

  it("geometric mean aggregates experts", () => {
    const a = [
      [1, 2],
      [0.5, 1],
    ];
    const b = [
      [1, 8],
      [0.125, 1],
    ];
    const g = aggregatePairwiseGeometric([a, b]);
    expect(g[0]![1]).toBeCloseTo(4, 12);
  });
});
