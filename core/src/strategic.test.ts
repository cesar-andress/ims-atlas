import { describe, expect, it } from "vitest";
import { buildStrategicMatrix, quadrantOf } from "./strategic.js";

describe("strategic matrix", () => {
  it("assigns quadrants with median cut-offs", () => {
    const ranking = [
      { iso3: "AAA", score: 3, rank: 1 },
      { iso3: "BBB", score: 2, rank: 2 },
      { iso3: "CCC", score: 1, rank: 3 },
      { iso3: "DDD", score: 0.5, rank: 4 },
    ];
    const factorScores = {
      AAA: { demand: 1, product_fit: 1, cost_access: 1, logistics: 1 },
      BBB: { demand: 1, product_fit: 0, cost_access: 0, logistics: 0 },
      CCC: { demand: 0, product_fit: 1, cost_access: 1, logistics: 1 },
      DDD: { demand: 0, product_fit: 0, cost_access: 0, logistics: 0 },
    };
    const result = buildStrategicMatrix({
      ranking,
      factorScores,
      attractivenessFactors: ["demand"],
      fitFactors: ["product_fit", "cost_access", "logistics"],
      cutoff: "median",
    });
    expect(result.points).toHaveLength(4);
    expect(result.cutAttractiveness).toBe(0.5);
    const byIso = Object.fromEntries(result.points.map((p) => [p.iso3, p]));
    expect(byIso.AAA!.quadrant).toBe(1);
    expect(byIso.DDD!.quadrant).toBe(3);
  });

  it("quadrant helper matches Cartesian regions", () => {
    expect(quadrantOf(1, 1, 0.5, 0.5)).toBe(1);
    expect(quadrantOf(0, 1, 0.5, 0.5)).toBe(2);
    expect(quadrantOf(0, 0, 0.5, 0.5)).toBe(3);
    expect(quadrantOf(1, 0, 0.5, 0.5)).toBe(4);
  });
});
