import { describe, expect, it } from "vitest";
import {
  buildAgreementReport,
  gwetAc1,
  hitRate,
  landisKochFromKappa,
  pabak,
} from "./agreementStats.js";

describe("agreementStats", () => {
  const pairs = [
    { ai: 1.0, verified: 1.0 },
    { ai: 2.0, verified: 2.01 },
    { ai: 3.0, verified: 5.0 },
    { ai: 4.0, verified: 4.0 },
  ];

  it("hit rate uses tolerance", () => {
    expect(hitRate(pairs, 0.05)).toBeCloseTo(0.75, 9);
  });

  it("PABAK and AC1 are finite", () => {
    expect(pabak(pairs, 0.05)).toBeCloseTo(0.5, 9);
    expect(Number.isFinite(gwetAc1(pairs, 0.05))).toBe(true);
  });

  it("Landis–Koch label comes from the chosen statistic only", () => {
    expect(landisKochFromKappa(0.71)).toBe("substantial");
    const r = buildAgreementReport("FSIN", pairs, 0.05, "kappa");
    expect(r.labelStat).toBe("kappa");
    expect(r.landisKochLabel).toBe(landisKochFromKappa(r.kappa));
  });
});
