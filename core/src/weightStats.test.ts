import { describe, expect, it } from "vitest";
import { weightStatsFromHierarchical } from "./weightStats.js";
import type { HierarchicalWeights } from "./types.js";

describe("weightStatsFromHierarchical", () => {
  it("mirrors factor and within means", () => {
    const w: HierarchicalWeights = {
      factors: { COST: 0.6, LOGI: 0.4 },
      variablesWithin: {
        COST: { x: 0.5, y: 0.5 },
        LOGI: { z: 1 },
      },
      scheme: "test",
      notes: [],
    };
    const stats = weightStatsFromHierarchical(w, {
      relativeSigma: 0.25,
      minSigma: 0.02,
    });
    expect(stats.factorNames).toEqual(["COST", "LOGI"]);
    expect(stats.factorMu[0]).toBeCloseTo(0.6, 12);
    expect(stats.within.COST!.names).toEqual(["x", "y"]);
    expect(stats.within.COST!.mu[0]).toBeCloseTo(0.5, 12);
    expect(stats.factorSigma[0]).toBeGreaterThanOrEqual(0.02);
  });
});
