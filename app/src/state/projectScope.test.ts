import { describe, expect, it } from "vitest";
import {
  equalFactorWeights,
  isScopeComplete,
  missingScopeFields,
  normalizeHsDraft,
  parseYearDraft,
} from "./projectScope";

describe("projectScope", () => {
  it("parses a valid year draft and rejects junk", () => {
    expect(parseYearDraft("2023")).toBe(2023);
    expect(parseYearDraft(" 2019 ")).toBe(2019);
    expect(parseYearDraft("")).toBeUndefined();
    expect(parseYearDraft("19.5")).toBeUndefined();
    expect(parseYearDraft("1800")).toBeUndefined();
  });

  it("normalises HS drafts to 2–6 digits", () => {
    expect(normalizeHsDraft("02")).toBe("02");
    expect(normalizeHsDraft("HS-6403")).toBe("6403");
    expect(normalizeHsDraft("6")).toBeUndefined();
    expect(normalizeHsDraft("")).toBeUndefined();
  });

  it("lists missing scope fields and gates completeness", () => {
    expect(missingScopeFields({})).toEqual(["origin", "hs", "year"]);
    expect(missingScopeFields({ origin: "COL", hs: "02" })).toEqual(["year"]);
    expect(isScopeComplete({ origin: "COL", hs: "02", year: 2023 })).toBe(true);
    expect(isScopeComplete({ origin: "col", hs: "02", year: 2023 })).toBe(false);
  });

  it("builds equal factor weights that sum to 1", () => {
    const w = equalFactorWeights(["demand", "logistics", "cost_access"]);
    expect(Object.keys(w)).toHaveLength(3);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});
