import { describe, expect, it } from "vitest";
import { tornadoWeightSensitivity } from "./sensitivity.js";
import type { HierarchicalWeights } from "./types.js";

const weights: HierarchicalWeights = {
  factors: { A: 0.5, B: 0.5 },
  variablesWithin: {
    A: { a1: 1 },
    B: { b1: 1 },
  },
  scheme: "test",
  notes: [],
};

describe("tornadoWeightSensitivity", () => {
  it("is deterministic and ordered by max effect", () => {
    const normalized = [
      [1, 0],
      [0.5, 0.5],
      [0, 1],
      [0.8, 0.2],
    ];
    const columns = ["a1", "b1"];
    const a = tornadoWeightSensitivity(normalized, columns, weights, { scale: 0.5 });
    const b = tornadoWeightSensitivity(normalized, columns, weights, { scale: 0.5 });
    expect(a).toEqual(b);
    expect(a.length).toBe(2);
    expect(a.every((bar) => bar.lowDelta >= 0 && bar.highDelta >= 0)).toBe(true);
    const maxes = a.map((bar) => Math.max(bar.lowDelta, bar.highDelta));
    for (let i = 1; i < maxes.length; i++) {
      expect(maxes[i]!).toBeLessThanOrEqual(maxes[i - 1]! + 1e-12);
    }
  });

  it("includeVariables adds variable-level bars", () => {
    const normalized = [
      [1, 0],
      [0, 1],
    ];
    const bars = tornadoWeightSensitivity(normalized, ["a1", "b1"], weights, {
      includeVariables: true,
    });
    expect(bars.some((b) => b.level === "variable")).toBe(true);
  });
});
