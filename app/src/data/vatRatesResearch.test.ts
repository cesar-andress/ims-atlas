import { describe, expect, it } from "vitest";
import { vatRateForIso3 } from "./vatRatesResearch";

describe("vatRateForIso3", () => {
  it("returns Germany 19% with citation", () => {
    const hit = vatRateForIso3("DEU");
    expect(hit?.rate).toBeCloseTo(0.19, 9);
    expect(hit?.sourceNote).toMatch(/Bundesministerium/);
    expect(hit?.sourceId).toBe("vat_rates");
  });

  it("skips placeholder USA row", () => {
    expect(vatRateForIso3("USA")).toBeNull();
  });

  it("returns null for unknown ISO3", () => {
    expect(vatRateForIso3("ZZZ")).toBeNull();
    expect(vatRateForIso3(undefined)).toBeNull();
  });
});
