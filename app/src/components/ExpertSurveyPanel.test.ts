import { describe, expect, it } from "vitest";
import {
  aggregateExpertMeans,
  ahpFromPairwise,
  anonymizeExpertLabels,
  IMSFE_2025_FOOTWEAR,
  validateUnitWeights,
} from "@ims-atlas/core";

describe("expert survey + AHP (Phase J UI helpers)", () => {
  it("anonymizes labels and aggregates means to unit sum", () => {
    const labels = anonymizeExpertLabels(2);
    expect(labels).toEqual(["Expert 1", "Expert 2"]);
    const base = IMSFE_2025_FOOTWEAR.criterionWeights;
    const agg = aggregateExpertMeans([
      { label: labels[0]!, criteria: { ...base }, variablesWithin: {} },
      { label: labels[1]!, criteria: { ...base }, variablesWithin: {} },
    ]);
    const sum = Object.values(agg.meanCriteria).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(validateUnitWeights(agg.meanCriteria).ok).toBe(true);
  });

  it("AHP identity matrix has CR near 0", () => {
    const n = 6;
    const m = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 1)),
    );
    const r = ahpFromPairwise(m);
    expect(r.cr).toBeLessThan(1e-9);
    expect(r.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
});
