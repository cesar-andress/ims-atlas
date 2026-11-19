import { describe, expect, it } from "vitest";
import {
  combinedRankGrid,
  combinedScore,
  normalizeEoc,
  normalizeImsfe,
} from "./combinedScore.js";

describe("combined IMSFE+EOC (A6)", () => {
  it("normalises IMSFE to 10 at the max", () => {
    const n = normalizeImsfe({ A: 5, B: 2.5 });
    expect(n.A).toBeCloseTo(10, 12);
    expect(n.B).toBeCloseTo(5, 12);
  });

  it("warns when EOC×5 exceeds 10", () => {
    const { values, warnings } = normalizeEoc({ X: 3 }, "times_5");
    expect(values.X).toBe(15);
    expect(warnings.length).toBe(1);
  });

  it("50/50 combined and sensitivity grid", () => {
    const imsfe = { CHE: 6, DEU: 4, USA: 5 };
    const eoc = { CHE: 1, DEU: 2, USA: 1.5 };
    const im = normalizeImsfe(imsfe);
    const eo = normalizeEoc(eoc, "ratio_to_max").values;
    const mid = combinedScore(im, eo, 0.5);
    expect(Object.keys(mid)).toHaveLength(3);
    const { grid } = combinedRankGrid(imsfe, eoc);
    expect(grid).toHaveLength(5);
    expect(grid[2]?.a).toBe(0.5);
    expect(grid[0]?.top10.length).toBeGreaterThan(0);
  });
});
