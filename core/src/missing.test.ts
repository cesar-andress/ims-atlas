import { describe, expect, it } from "vitest";
import { InsufficientCandidatesError, prepareBlock } from "./missing.js";

describe("prepareBlock", () => {
  it("refuses n_candidates < 20", () => {
    expect(() =>
      prepareBlock({
        candidates: Array.from({ length: 19 }, (_, i) => `C${i}`),
        columns: ["A"],
        values: Array.from({ length: 19 }, () => [1]),
      }),
    ).toThrow(InsufficientCandidatesError);
  });

  it("excludes variables above missing threshold and median-imputes", () => {
    const n = 20;
    const candidates = Array.from(
      { length: n },
      (_, i) => `C${String(i).padStart(2, "0")}`,
    );
    const values = candidates.map((_, i) => [
      i < 5 ? null : i, // 25% missing → exclude
      i === 0 ? null : 10 + i, // one missing → impute
    ]);
    const prep = prepareBlock({
      candidates,
      columns: ["HIGH_MISS", "OK"],
      values,
      policy: { maxMissingShare: 0.2, minCandidates: 20 },
    });
    expect(prep.excludedVariables).toEqual(["HIGH_MISS"]);
    expect(prep.usedVariables).toEqual(["OK"]);
    expect(prep.nImputedCells).toBe(1);
    expect(prep.imputedMask[0]![0]).toBe(true);
    expect(prep.matrix.length).toBe(20);
  });
});
