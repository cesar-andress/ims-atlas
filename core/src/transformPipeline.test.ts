import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  applySkewTransform,
  runColumnPipeline,
  scaleBenefit,
  winsorize,
} from "./transformPipeline.js";

describe("transformPipeline", () => {
  it("log1p and winsor leave missing as NaN", () => {
    const skewed = applySkewTransform([1, null, -2], "log1p");
    expect(skewed[0]).toBeCloseTo(Math.log1p(1), 12);
    expect(Number.isNaN(skewed[1]!)).toBe(true);
    expect(Number.isNaN(skewed[2]!)).toBe(true);
  });

  it("winsor flags extremes", () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const { values, flags } = winsorize(series, "winsor_1_99");
    expect(flags[flags.length - 1]).toBe(true);
    expect(values[values.length - 1]!).toBeLessThan(100);
  });

  it("direction after scale flips cost on minmax", () => {
    const benefit = runColumnPipeline([1, 2, 10], {
      skew: "none",
      outlier: "none",
      scale: "minmax",
      direction: "benefit",
    });
    const cost = runColumnPipeline([1, 2, 10], {
      skew: "none",
      outlier: "none",
      scale: "minmax",
      direction: "cost",
    });
    expect(benefit.values[2]).toBeCloseTo(10, 12);
    expect(cost.values[2]).toBeCloseTo(0, 12);
    expect(cost.values[0]).toBeCloseTo(10, 12);
  });

  it("monotonic skew preserves order (property)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0.1, max: 1e6, noNaN: true }), {
          minLength: 3,
          maxLength: 20,
        }),
        (xs) => {
          const logged = applySkewTransform(xs, "log");
          for (let i = 1; i < xs.length; i++) {
            if (xs[i]! >= xs[i - 1]!) {
              expect(logged[i]!).toBeGreaterThanOrEqual(logged[i - 1]!);
            }
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it("constant column scales without NaN leak", () => {
    const out = scaleBenefit([3, 3, 3], "minmax", 10);
    expect(out).toEqual([5, 5, 5]);
    const z = scaleBenefit([3, 3, 3], "zscore");
    expect(z).toEqual([0, 0, 0]);
    const rz = scaleBenefit([3, 3, 3], "robust_z");
    expect(rz).toEqual([0, 0, 0]);
  });

  it("direction flip reverses order on minmax", () => {
    const xs = [1, 5, 10];
    const benefit = runColumnPipeline(xs, {
      skew: "none",
      outlier: "none",
      scale: "minmax",
      direction: "benefit",
    }).values;
    const cost = runColumnPipeline(xs, {
      skew: "none",
      outlier: "none",
      scale: "minmax",
      direction: "cost",
    }).values;
    for (let i = 1; i < xs.length; i++) {
      expect(Math.sign(benefit[i]! - benefit[i - 1]!)).toBe(
        -Math.sign(cost[i]! - cost[i - 1]!),
      );
    }
  });
});
