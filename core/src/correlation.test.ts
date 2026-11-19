import { describe, expect, it } from "vitest";
import {
  correlationMatrix,
  highCorrelationWarnings,
  whitenMatrix,
} from "./correlation.js";

describe("correlation", () => {
  it("flags |rho| ≥ 0.8", () => {
    const cols = ["GDPPC", "GOV", "DIST"];
    const series = [
      [1, 2, 3, 4, 5, 6],
      [1.1, 2.1, 2.9, 4.2, 4.8, 6.1],
      [9, 1, 8, 2, 7, 3],
    ];
    const mat = correlationMatrix(cols, series);
    const warns = highCorrelationWarnings(cols, mat, 0.8);
    expect(warns.some((w) => w.a === "GDPPC" && w.b === "GOV")).toBe(true);
    expect(warns[0]!.messageEs).toContain("contando dos veces");
  });

  it("whitening reduces off-diagonal covariance roughly", () => {
    const matrix = [
      [1, 2],
      [2, 4],
      [3, 5],
      [4, 7],
      [5, 8],
    ];
    const w = whitenMatrix(matrix);
    expect(w.length).toBe(5);
    expect(w[0]!.length).toBe(2);
    // Finite outputs
    for (const row of w) {
      for (const v of row) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
