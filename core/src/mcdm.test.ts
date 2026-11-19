import { describe, expect, it } from "vitest";
import { scorePrometheeIi, scoreTopsis } from "./mcdm.js";
import type { HierarchicalWeights } from "./types.js";

const flatW = (cols: string[], w: number[]): HierarchicalWeights => ({
  factors: { f: 1 },
  variablesWithin: {
    f: Object.fromEntries(cols.map((c, i) => [c, w[i]!])),
  },
  scheme: "manual",
  notes: [],
});

describe("mcdm pymcdm examples", () => {
  it("TOPSIS matches pymcdm docstring rounded values", () => {
    const matrix = [
      [1, 3000],
      [2, 3750],
      [5, 4500],
    ];
    const cols = ["c0", "c1"];
    const scores = scoreTopsis(matrix, cols, flatW(cols, [0.5, 0.5]), {
      c0: "cost",
      c1: "benefit",
    });
    expect(scores.map((x) => Number(x.toFixed(3)))).toEqual([0.5, 0.617, 0.5]);
  });

  it("PROMETHEE II usual matches pymcdm docstring", () => {
    const matrix = [
      [4, 3, 2],
      [3, 2, 4],
      [5, 1, 3],
    ];
    const cols = ["a", "b", "c"];
    const scores = scorePrometheeIi(matrix, cols, flatW(cols, [0.5, 0.3, 0.2]), {
      a: "benefit",
      b: "benefit",
      c: "benefit",
    });
    expect(scores.map((x) => Number(x.toFixed(2)))).toEqual([0.1, -0.3, 0.2]);
  });
});
