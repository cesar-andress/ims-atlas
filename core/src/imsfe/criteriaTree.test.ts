import { describe, expect, it } from "vitest";
import {
  IMSFEM_2025_OLIVE,
  IMSFE_2025_FOOTWEAR,
  orderKeysByWeight,
  renormalizeWeights,
  scoreImsfeTree,
  swapVariableInCriterion,
  weightedSum,
} from "./criteriaTree.js";

describe("renormalizeWeights", () => {
  it("leaves unit-sum weights unchanged", () => {
    const r = renormalizeWeights({ a: 0.4, b: 0.6 });
    expect(r.renormalised).toBe(false);
    expect(r.weights.a).toBeCloseTo(0.4, 12);
  });

  it("renormalises when sum ≠ 1 and records a note", () => {
    const r = renormalizeWeights({ COST: 0.5, LOGI: 0.4975 });
    expect(r.renormalised).toBe(true);
    expect(r.rawSum).toBeCloseTo(0.9975, 12);
    expect(r.note).toMatch(/0\.997500/);
    const s = Object.values(r.weights).reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1, 12);
  });
});

describe("scoreImsfeTree", () => {
  it("scores a 6-criterion tree with SUMPRODUCT", () => {
    const varScores: Record<string, number> = {};
    for (const vars of Object.values(IMSFE_2025_FOOTWEAR.structure)) {
      for (const v of vars) varScores[v] = 5;
    }
    const r = scoreImsfeTree(IMSFE_2025_FOOTWEAR, varScores);
    expect(Object.keys(r.criterionScores)).toHaveLength(6);
    for (const c of Object.keys(IMSFE_2025_FOOTWEAR.structure)) {
      expect(r.criterionScores[c]).toBeCloseTo(5, 9);
    }
    expect(r.total).toBeCloseTo(5, 9);
  });

  it("scores a 7-criterion olive-oil tree", () => {
    const varScores: Record<string, number> = {};
    for (const vars of Object.values(IMSFEM_2025_OLIVE.structure)) {
      for (const v of vars) varScores[v] = 4;
    }
    const r = scoreImsfeTree(IMSFEM_2025_OLIVE, varScores);
    expect(Object.keys(r.criterionScores)).toHaveLength(7);
    expect(r.criterionScores.SUST).toBeCloseTo(4, 9);
    expect(r.total).toBeCloseTo(4, 9);
  });

  it("renormalises criterion weights that do not sum to 1", () => {
    const varScores: Record<string, number> = {};
    for (const vars of Object.values(IMSFEM_2025_OLIVE.structure)) {
      for (const v of vars) varScores[v] = 10;
    }
    const skewed = {
      COST: 0.23,
      LOGI: 0.16,
      COMM: 0.19,
      ECON: 0.14,
      POLI: 0.1,
      SUST: 0.085,
      CULT: 0.0825,
    };
    expect(Object.values(skewed).reduce((a, b) => a + b, 0)).toBeCloseTo(0.9875, 12);
    const r = scoreImsfeTree(IMSFEM_2025_OLIVE, varScores, {
      criterionWeights: skewed,
    });
    expect(r.renormalizeNotes.some((n) => n.startsWith("criteria:"))).toBe(true);
    expect(r.total).toBeCloseTo(10, 9);
  });
});

describe("orderKeysByWeight display-only", () => {
  it("does not change scoreImsfeTree results", () => {
    const varScores: Record<string, number> = {
      PPAD: 8,
      INTC: 3,
      CIBC: 1,
      LPIN: 9,
      CPTR: 2,
      ITTT: 1.5,
      CUTA: 0.5,
      CCTI: 0.1,
      IOEF: 8,
      CLI: 6,
      INAN: 2,
      UNRA: 4,
      FSIN: 3,
      INRI: 2,
      DEIN: 8,
      GLIN: 9,
      CPIN: 7,
      CUDI: 6,
    };
    const before = scoreImsfeTree(IMSFE_2025_FOOTWEAR, varScores);
    const displayCrit = orderKeysByWeight(
      IMSFE_2025_FOOTWEAR.criterionWeights,
      Object.keys(IMSFE_2025_FOOTWEAR.structure),
    );
    expect(displayCrit[0]).toBe("COST");
    const after = scoreImsfeTree(IMSFE_2025_FOOTWEAR, varScores);
    expect(after.total).toBe(before.total);
    expect(after.criterionScores).toEqual(before.criterionScores);
    // Reordering keys in a copy must not affect weightedSum
    const reordered = Object.fromEntries(
      displayCrit.map((k) => [k, before.criterionScores[k]!]),
    );
    expect(weightedSum(IMSFE_2025_FOOTWEAR.criterionWeights, reordered)).toBeCloseTo(
      before.total,
      12,
    );
  });
});

describe("swapVariableInCriterion", () => {
  it("swaps CPTR → RQBC inside LOGI", () => {
    const next = swapVariableInCriterion(
      IMSFE_2025_FOOTWEAR,
      "LOGI",
      "CPTR",
      "RQBC",
      "benefit",
    );
    expect(next.structure.LOGI).toEqual(["LPIN", "RQBC", "ITTT"]);
    expect(next.variableWeights.RQBC).toBe(IMSFE_2025_FOOTWEAR.variableWeights.CPTR);
    expect(next.variableWeights.CPTR).toBeUndefined();
    expect(IMSFE_2025_FOOTWEAR.structure.LOGI).toContain("CPTR");
  });
});
