import { describe, expect, it } from "vitest";
import { compareExportTables, compareProjects } from "./projectCompare.js";

describe("projectCompare (A8)", () => {
  it("lists weight and rank changes between two snapshots", () => {
    const r = compareProjects([
      {
        id: "col",
        label: "Calzado COL 2025",
        nCriteria: 6,
        criterionWeights: { COST: 0.22, LOGI: 0.18 },
        variableIds: ["PPAD", "CPTR"],
        topMarkets: ["CHE", "SGP"],
        methodNotes: ["6×3 footwear"],
        scores: { CHE: 6.1, DEU: 4.7, USA: 4.4 },
        values: { PPAD: { CHE: 100, DEU: 90 } },
      },
      {
        id: "esp",
        label: "Aceite ESP 2025",
        nCriteria: 7,
        criterionWeights: { COST: 0.23, SUST: 0.08 },
        variableIds: ["PPAD", "RQBC", "CADE"],
        topMarkets: ["CHE", "DNK"],
        methodNotes: ["7×3 olive"],
        scores: { CHE: 6.7, DEU: 5.0, USA: 4.0 },
        values: { PPAD: { CHE: 110, DEU: 90 } },
      },
    ]);
    expect(r.methodDiffNotes.some((n) => n.includes("6") && n.includes("7"))).toBe(
      true,
    );
    expect(r.rankChanges.find((x) => x.iso3 === "CHE")).toBeTruthy();
    expect(
      r.valueChanges.some((v) => v.variableId === "PPAD" && v.iso3 === "CHE"),
    ).toBe(true);
    const tables = compareExportTables(r);
    expect(tables.readme[0]?.[0]).toMatch(/comparison/i);
    expect(tables.ranks[0]?.[0]).toBe("iso3");
  });
});
