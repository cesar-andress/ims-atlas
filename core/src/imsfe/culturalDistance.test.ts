import { describe, expect, it } from "vitest";
import { culturalDistance } from "./culturalDistance.js";

describe("culturalDistance", () => {
  it("sums absolute Hofstede gaps", () => {
    const origin = {
      power_distance: 67,
      individualism: 29,
      motivation_achievement: 64,
      uncertainty_avoidance: 80,
      long_term_orientation: 6,
      indulgence: 83,
    };
    const dest = {
      power_distance: 34,
      individualism: 79,
      motivation_achievement: 70,
      uncertainty_avoidance: 58,
      long_term_orientation: 42,
      indulgence: 66,
    };
    // |67-34|+|29-79|+|64-70|+|80-58|+|6-42|+|83-66| = 33+50+6+22+36+17 = 164
    expect(culturalDistance(origin, dest)).toBe(164);
  });
});
