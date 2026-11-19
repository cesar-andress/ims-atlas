import { describe, expect, it } from "vitest";
import { buildCoverageCells, summarizeCoverage } from "./coverageGrid";

describe("coverageGrid", () => {
  it("flags outside_release and summarizes gaps", () => {
    const cells = buildCoverageCells({
      variableIds: ["GDPPC", "LPI"],
      years: [2015, 2017, 2019],
      candidates: ["USA", "DEU"],
      inRelease: new Set(["GDPPC"]),
      byodMissing: new Set(),
      cadenceYears: { LPI: [2016, 2018, 2020] },
      values: {
        GDPPC: {
          2015: { USA: 1, DEU: 2 },
          2017: { USA: 1, DEU: null },
          2019: { USA: 1, DEU: 2 },
        },
      },
    });
    expect(
      cells.some((c) => c.variableId === "LPI" && c.state === "outside_release"),
    ).toBe(true);
    const sum = summarizeCoverage(cells, ["GDPPC", "LPI"], 2015, 2019);
    expect(sum.nWithGaps).toBeGreaterThan(0);
    expect(sum.linesEn[0]).toMatch(/of 2 variables/);
  });
});
