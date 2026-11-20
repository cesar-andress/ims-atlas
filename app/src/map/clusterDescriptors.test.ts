import { describe, expect, it } from "vitest";
import { clusterDescriptors } from "./clusterDescriptors";

describe("clusterDescriptors", () => {
  it("labels clusters by top mean factors", () => {
    const nodes = [
      { iso3: "AAA", x: 0, y: 0, score: 1, cluster: 0, rank: 1 },
      { iso3: "BBB", x: 1, y: 1, score: 1, cluster: 0, rank: 2 },
      { iso3: "CCC", x: 2, y: 2, score: 1, cluster: 1, rank: 3 },
    ];
    const factorScores = {
      AAA: { logistics: 9, cost: 1 },
      BBB: { logistics: 8, cost: 2 },
      CCC: { logistics: 1, cost: 9 },
    };
    const d = clusterDescriptors(nodes, factorScores, ["logistics", "cost"], 2);
    expect(d[0]).toContain("logistics");
    expect(d[1]).toContain("cost");
  });
});
