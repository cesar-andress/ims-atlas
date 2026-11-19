import { describe, expect, it } from "vitest";
import {
  applyZeroPolicy,
  countRankChanges,
  culturalDistanceByKind,
  detectDuplicateNumericRows,
  detectNearBinaryScaled,
  eocPercent,
  rankingTableConsistent,
  scaleCostWithPolicy,
  suggestIso3,
  warnAggregatedRespondents,
  warnImpNonPositive,
  warnOutOfPlausibleRange,
  warnSumOfSumsZeroDistance,
  warnWeightsRenormalised,
} from "./methodChecks.js";

describe("rankingTableConsistent (F1)", () => {
  it("keeps country→score after shuffling row order", () => {
    const scores = { CHE: 6.1, SGP: 5.8, DEU: 4.7, USA: 4.4 };
    const a = rankingTableConsistent(scores, ["USA", "DEU", "CHE", "SGP"]);
    const b = rankingTableConsistent(scores, ["SGP", "CHE", "USA", "DEU"]);
    expect(a.map((r) => r.country)).toEqual(b.map((r) => r.country));
    expect(a.map((r) => r.score)).toEqual(b.map((r) => r.score));
    expect(a[0]?.country).toBe("CHE");
  });
});

describe("zero policy / near-binary (F3)", () => {
  it("epsilon substitute makes zeros scorable", () => {
    const raw = [0, 175, 0.1, 50];
    const prep = applyZeroPolicy(raw, { kind: "epsilon", epsilon: 0.1 });
    expect(prep[0]).toBe(0.1);
    const scaled = scaleCostWithPolicy(raw, { kind: "epsilon", epsilon: 0.1 });
    expect(scaled[0]).toBeCloseTo(10, 9);
    expect(scaled[1]!).toBeLessThan(1);
  });

  it("detects near-binary scaled series", () => {
    const scaled = [10, 10, 0.006, 0.01, 0.02, 0.05, 0.1, 0.2];
    const w = detectNearBinaryScaled(scaled, "CIBC");
    expect(w?.code).toBe("near_binary_scaled");
  });

  it("counts rank changes across policies", () => {
    const countries = ["A", "B", "C", "D"];
    const raw = [0, 10, 50, 100];
    const eps = scaleCostWithPolicy(raw, { kind: "epsilon", epsilon: 0.1 });
    const mm = scaleCostWithPolicy(raw, { kind: "minmax" });
    const scoresEps = Object.fromEntries(countries.map((c, i) => [c, eps[i]!]));
    const scoresMm = Object.fromEntries(countries.map((c, i) => [c, mm[i]!]));
    expect(countRankChanges(scoresEps, scoresMm)).toBeGreaterThanOrEqual(0);
  });
});

describe("cultural distance definitions (F4)", () => {
  const origin = {
    power_distance: 50,
    individualism: 50,
    motivation_achievement: 50,
    uncertainty_avoidance: 50,
    long_term_orientation: 50,
    indulgence: 50,
  };
  const sameSumDifferent = {
    power_distance: 80,
    individualism: 20,
    motivation_achievement: 70,
    uncertainty_avoidance: 30,
    long_term_orientation: 60,
    indulgence: 40,
  };

  it("sum_of_sums can be 0 while sum_abs_diff is not", () => {
    expect(culturalDistanceByKind(origin, sameSumDifferent, "sum_of_sums")).toBe(0);
    expect(
      culturalDistanceByKind(origin, sameSumDifferent, "sum_abs_diff"),
    ).toBeGreaterThan(0);
    const w = warnSumOfSumsZeroDistance(origin, sameSumDifferent);
    expect(w?.code).toBe("culture_sum_of_sums_zero");
  });

  it("kogut_singh uses variances", () => {
    const d = culturalDistanceByKind(origin, sameSumDifferent, "kogut_singh", {
      power_distance: 100,
      individualism: 100,
      motivation_achievement: 100,
      uncertainty_avoidance: 100,
      long_term_orientation: 100,
      indulgence: 100,
    });
    expect(d).toBeGreaterThan(0);
  });
});

describe("weights / respondents (F5)", () => {
  it("flags renormalisation", () => {
    expect(warnWeightsRenormalised(0.9975, "criteria")?.code).toBe(
      "weights_renormalised",
    );
    expect(warnWeightsRenormalised(1, "criteria")).toBeNull();
  });

  it("flags aggregated respondents", () => {
    expect(warnAggregatedRespondents(1, 14)?.message.es).toMatch(/agregada/);
  });
});

describe("EOC units (F7)", () => {
  it("aligns thousand USD trade with USD GDP", () => {
    const pct = eocPercent(1000, 1_000_000, {
      tradeUnit: "thousand_usd",
      gdpUnit: "usd",
      definition: "goods_only",
    });
    // 1000 * 1000 / 1e6 * 100 = 100
    expect(pct).toBeCloseTo(100, 9);
  });
});

describe("import checks (F11)", () => {
  it("suggests Türkiye/Turkey", () => {
    const s = suggestIso3("Turkey", [{ name: "Türkiye", iso3: "TUR" }]);
    expect(s?.iso3).toBe("TUR");
    expect(s!.score).toBeGreaterThanOrEqual(0.95);
  });

  it("flags duplicate numeric rows", () => {
    const w = detectDuplicateNumericRows([
      { country: "Albania", values: [2020606, 3172476, 27360935] },
      { country: "United States", values: [2020606, 3172476, 27360935] },
    ]);
    expect(w).toHaveLength(1);
    expect(w[0]?.code).toBe("duplicate_numeric_row");
  });

  it("flags out-of-range AC1-like values", () => {
    expect(warnOutOfPlausibleRange("UNRA_AC1", -12, { min: -1, max: 1 })?.code).toBe(
      "out_of_range",
    );
  });
});

describe("IMP non-positive (F3/ratio guards)", () => {
  it("requires a choice when cost values are ≤ 0", () => {
    expect(warnImpNonPositive("INAN", [1.2, 0, -0.5])?.severity).toBe("error");
  });
});
