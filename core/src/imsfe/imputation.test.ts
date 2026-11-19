import { describe, expect, it } from "vitest";
import {
  evaluateImputationHoldout,
  imputeCrossSection,
  imputeLinearInterp,
  imputeLocf,
  imputeLogLinearTrend,
} from "./imputation.js";

describe("imputation (A5)", () => {
  const series = [
    { year: 2018, value: 10 },
    { year: 2019, value: null },
    { year: 2020, value: 14 },
    { year: 2021, value: 16 },
    { year: 2022, value: 100 }, // future relative to t=2020
  ];

  it("LOCF uses only years <= t and reports age", () => {
    const r = imputeLocf(series, 2019);
    expect(r?.value).toBe(10);
    expect(r?.ageYears).toBe(1);
    expect(r?.inputYears).toEqual([2018]);
  });

  it("linear interp may use asOfYear brackets but never years > asOf", () => {
    const gap = [
      { year: 2018, value: 10 },
      { year: 2019, value: null },
      { year: 2020, value: 14 },
      { year: 2022, value: 99 },
    ];
    // Fill 2019 as-of 2020 → uses 2018 and 2020
    const mid = imputeLinearInterp(gap, 2019, 2020);
    expect(mid?.value).toBeCloseTo(12, 9);
    expect(mid?.inputYears).toEqual([2018, 2020]);
    // Same cell as-of 2019 cannot see 2020
    expect(imputeLinearInterp(gap, 2019, 2019)).toBeNull();
  });

  it("no leakage: future change after t does not affect LOCF at t", () => {
    const base = [
      { year: 2018, value: 10 },
      { year: 2019, value: null },
    ];
    const a = imputeLocf(base, 2019);
    const b = imputeLocf([...base, { year: 2020, value: 999 }], 2019);
    expect(a?.value).toBe(b?.value);
    expect(a?.value).toBe(10);
  });

  it("log-linear trend predicts from past only", () => {
    const r = imputeLogLinearTrend(
      [
        { year: 2016, value: Math.E ** 1 },
        { year: 2017, value: Math.E ** 2 },
        { year: 2018, value: Math.E ** 3 },
        { year: 2019, value: null },
      ],
      2019,
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeGreaterThan(0);
  });

  it("cross-section OLS predicts missing country", () => {
    const rows = [
      { iso3: "A", y: 10, x: [1] },
      { iso3: "B", y: 20, x: [2] },
      { iso3: "C", y: 30, x: [3] },
      { iso3: "T", y: null, x: [2.5] },
    ];
    const r = imputeCrossSection(rows, "T");
    expect(r?.value).toBeCloseTo(25, 5);
  });

  it("hold-out evaluation ranks methods by MAE", () => {
    const long = [
      { year: 2015, value: 10 },
      { year: 2016, value: 12 },
      { year: 2017, value: 14 },
      { year: 2018, value: 16 },
      { year: 2019, value: 18 },
    ];
    const ev = evaluateImputationHoldout(long);
    expect(ev.length).toBeGreaterThan(0);
    expect(ev[0]!.mae).toBeLessThanOrEqual(ev[ev.length - 1]!.mae);
  });
});
