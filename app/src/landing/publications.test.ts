import { describe, expect, it } from "vitest";
import { LANDING_PUBLICATIONS } from "./publications";

describe("landing publications", () => {
  it("lists exactly 7 peer-reviewed references with urls", () => {
    expect(LANDING_PUBLICATIONS).toHaveLength(7);
    for (const p of LANDING_PUBLICATIONS) {
      expect(p.url.startsWith("http")).toBe(true);
      expect(p.title.trim().length).toBeGreaterThan(10);
      expect(p.year).toBeGreaterThanOrEqual(2018);
    }
  });

  it("only includes DOIs that appear in the publisher URL", () => {
    for (const p of LANDING_PUBLICATIONS) {
      if (!p.doi) continue;
      expect(p.url).toContain(p.doi);
    }
  });
});
