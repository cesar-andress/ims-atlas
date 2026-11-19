import { describe, expect, it } from "vitest";
import { oneAtATimeWinnerThresholds } from "./winnerSensitivity.js";

describe("oneAtATimeWinnerThresholds", () => {
  it("finds a challenger when a factor weight moves", () => {
    const normalized = [
      [10, 1],
      [1, 10],
    ];
    const columns = ["a1", "b1"];
    const candidates = ["AAA", "BBB"];
    const weights = {
      factors: { A: 0.9, B: 0.1 },
      variablesWithin: { A: { a1: 1 }, B: { b1: 1 } },
      scheme: "manual",
      notes: [],
    };
    const rows = oneAtATimeWinnerThresholds({
      normalized,
      columns,
      candidates,
      weights,
      steps: 21,
    });
    const a = rows.find((r) => r.factor === "A");
    expect(a?.baselineWinner).toBe("AAA");
    expect(a?.lowerBeforeChange).not.toBeNull();
    expect(a?.challengerAtLower).toBe("BBB");
  });
});
