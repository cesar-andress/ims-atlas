import { describe, expect, it } from "vitest";
import { factorContributions } from "./mcdm.js";
import { restrictWeights, weightsManual } from "./weights.js";
import { scoreBlock } from "./score.js";
import type { VariableSpec } from "./types.js";

describe("overlapping factors bug", () => {
  const vars: VariableSpec[] = [
    { id: "IMPV", factor: "demand", direction: "benefit" },
    { id: "LPI", factor: "logistics", direction: "benefit" },
  ];

  it("weightsManual with disjoint UI keys still scores", () => {
    const w = weightsManual(
      { openness_legacy: 0.5, sustainability: 0.5 },
      {
        demand: { IMPV: 1 },
        logistics: { LPI: 1 },
      },
    );
    expect(Object.keys(w.factors).sort()).toEqual(["demand", "logistics"]);
    const restricted = restrictWeights(w, ["IMPV", "LPI"]);
    expect(Object.keys(restricted.factors).length).toBe(2);
    const scores = factorContributions(
      [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
      ["IMPV", "LPI"],
      restricted,
    ).scores;
    expect(scores).toHaveLength(3);
  });

  it("scoreBlock survives disjoint manual factorWeights", () => {
    const result = scoreBlock({
      candidates: ["AAA", "BBB", "CCC"],
      variables: vars,
      values: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "manual",
      manualWeights: {
        factors: { openness_legacy: 0.5, sustainability: 0.5 },
        variablesWithin: {
          demand: { IMPV: 1 },
          logistics: { LPI: 1 },
        },
      },
      policy: { maxMissingShare: 1, minCandidates: 1, impute: "none" },
    });
    expect(result.ranking.length).toBe(3);
  });
});
