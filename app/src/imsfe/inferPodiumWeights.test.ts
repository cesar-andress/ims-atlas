import { describe, expect, it } from "vitest";
import { inferPodiumWeights } from "./inferPodiumWeights";

describe("inferPodiumWeights", () => {
  it("puts more weight on the factor that matches the preferred order", () => {
    const factorScores = {
      AAA: { cost: 10, cult: 1 },
      BBB: { cost: 5, cult: 10 },
      CCC: { cost: 1, cult: 5 },
    };
    // Prefer high cost order: AAA > BBB > CCC
    const w = inferPodiumWeights(["AAA", "BBB", "CCC"], factorScores, ["cost", "cult"]);
    expect(w.cost!).toBeGreaterThan(w.cult!);
    expect(w.cost! + w.cult!).toBeCloseTo(1, 9);
  });
});
