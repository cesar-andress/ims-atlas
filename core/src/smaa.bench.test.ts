import { describe, expect, it } from "vitest";
import { runSmaaWsm, type WeightStats } from "./smaa.js";

describe("SMAA performance", () => {
  it("10k samples × 60 destinations finishes under 2s in Node", () => {
    const nAlt = 60;
    const cols = ["a", "b", "c", "d", "e", "f"];
    const normalized = Array.from({ length: nAlt }, (_, i) =>
      cols.map((_, j) => ((i + 1) * (j + 1)) % 10),
    );
    const alternatives = Array.from({ length: nAlt }, (_, i) => `C${i}`);
    const stats: WeightStats = {
      factorNames: ["f0", "f1"],
      factorMu: [0.5, 0.5],
      factorSigma: [0.1, 0.1],
      factorMin: [0.2, 0.2],
      factorMax: [0.8, 0.8],
      within: {
        f0: {
          names: ["a", "b", "c"],
          mu: [1 / 3, 1 / 3, 1 / 3],
          sigma: [0.1, 0.1, 0.1],
          min: [0.1, 0.1, 0.1],
          max: [0.6, 0.6, 0.6],
        },
        f1: {
          names: ["d", "e", "f"],
          mu: [1 / 3, 1 / 3, 1 / 3],
          sigma: [0.1, 0.1, 0.1],
          min: [0.1, 0.1, 0.1],
          max: [0.6, 0.6, 0.6],
        },
      },
    };
    const t0 = performance.now();
    const result = runSmaaWsm(normalized, alternatives, cols, stats, {
      nSamples: 10_000,
      seed: 42,
    });
    const ms = performance.now() - t0;
    expect(result.nSamples).toBe(10_000);
    expect(result.alternatives).toHaveLength(60);
    expect(ms).toBeLessThan(2000);
  });
});
