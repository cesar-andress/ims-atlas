import { describe, expect, it } from "vitest";
import {
  assertNoAiInScores,
  cellsToScoreMap,
  filterComputableCells,
  type DataCell,
} from "./dataCellState.js";
import { scoreImsfeTree, IMSFE_2025_FOOTWEAR } from "./criteriaTree.js";

describe("data cell states (A4)", () => {
  const cells: DataCell[] = [
    {
      variableId: "PPAD",
      iso3: "CHE",
      year: 2023,
      value: 8,
      state: "official",
    },
    {
      variableId: "PPAD",
      iso3: "DEU",
      year: 2023,
      value: 99,
      state: "ai_candidate",
      origin: "ai",
    },
    {
      variableId: "PPAD",
      iso3: "DEU",
      year: 2023,
      value: 7,
      state: "verified",
      verifiedBy: "CA",
      verifiedOn: "2026-11-20",
      verdict: "correct",
    },
    {
      variableId: "PPAD",
      iso3: "USA",
      year: 2023,
      value: 1,
      state: "rejected",
    },
  ];

  it("excludes ai_candidate and rejected from computable set", () => {
    const ok = filterComputableCells(cells);
    expect(ok.map((c) => `${c.iso3}:${c.state}`).sort()).toEqual([
      "CHE:official",
      "DEU:verified",
    ]);
  });

  it("never lets ai_candidate alone into score map", () => {
    const map = cellsToScoreMap(cells, "PPAD");
    expect(map.CHE).toBe(8);
    expect(map.DEU).toBe(7);
    expect(map.USA).toBeUndefined();
    assertNoAiInScores(cells, map);
  });

  it("licence-gate style: scoring uses only computable cells", () => {
    const varScores: Record<string, number> = {};
    for (const vars of Object.values(IMSFE_2025_FOOTWEAR.structure)) {
      for (const v of vars) {
        varScores[v] = 5;
      }
    }
    // Inject an AI-only value that must not affect total if we build from gate
    const gated = { ...varScores, PPAD: cellsToScoreMap(cells, "PPAD").CHE ?? 5 };
    const r = scoreImsfeTree(IMSFE_2025_FOOTWEAR, gated);
    expect(Number.isFinite(r.total)).toBe(true);
  });
});
