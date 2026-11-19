import { describe, expect, it } from "vitest";
import {
  IMSFE_EOC_QUADRANTS,
  buildImsfeEocMatrix,
  normalizeEocRatio,
} from "./eocMatrix.js";

describe("eocMatrix", () => {
  it("normalises EOC by max * 10", () => {
    expect(normalizeEocRatio([1, 2, 4])).toEqual([2.5, 5, 10]);
  });

  it("assigns Jose quadrant names", () => {
    const m = buildImsfeEocMatrix({
      rows: [
        { iso3: "AAA", imsfe: 9, eocRaw: 1, rank: 1 },
        { iso3: "BBB", imsfe: 2, eocRaw: 1, rank: 2 },
        { iso3: "CCC", imsfe: 9, eocRaw: 0.1, rank: 3 },
        { iso3: "DDD", imsfe: 2, eocRaw: 0.1, rank: 4 },
      ],
      cutoff: "fixed",
      fixedCutImsfe: 5,
      fixedCutEoc: 5,
    });
    const by = Object.fromEntries(m.points.map((p) => [p.iso3, p.quadrant]));
    expect(by.AAA).toBe(1);
    expect(by.BBB).toBe(2);
    expect(by.CCC).toBe(4);
    expect(by.DDD).toBe(3);
    expect(IMSFE_EOC_QUADRANTS[1].en).toBe("GLOBAL LEADERS");
    expect(IMSFE_EOC_QUADRANTS[1].es).toBe("Líderes globales");
  });
});
