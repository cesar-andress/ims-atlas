import { describe, expect, it } from "vitest";
import { intraEuDutyRate, projectFxRate } from "./euTradeContext";

describe("euTradeContext", () => {
  it("sets 0% duty ESP→DEU with customs-union source", () => {
    const d = intraEuDutyRate("ESP", "DEU");
    expect(d?.rate).toBe(0);
    expect(d?.sourceNote).toMatch(/Unión aduanera/);
  });

  it("leaves duty empty for ESP→USA", () => {
    expect(intraEuDutyRate("ESP", "USA")).toBeNull();
  });

  it("sets FX=1 for euro-area pair", () => {
    const fx = projectFxRate("ESP", "DEU");
    expect(fx?.rate).toBe(1);
    expect(fx?.sourceNote).toMatch(/euro/i);
  });
});
