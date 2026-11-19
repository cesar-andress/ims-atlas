import { afterEach, describe, expect, it } from "vitest";
import { cellsToScoreMap } from "@ims-atlas/core";
import {
  clearAiCandidates,
  mergeAiCandidates,
  parseAiCandidatesCsv,
  toDataCells,
  verifyCandidate,
} from "./aiCandidateStore";

afterEach(() => {
  clearAiCandidates();
});

describe("aiCandidateStore", () => {
  it("parses CSV and keeps candidates out of scores until verified", () => {
    const csv = [
      "variable_id,iso3,year,value,source_url,origin",
      "PPAD,CHE,2023,8.5,https://example.com,ai",
      "PPAD,DEU,2023,7.1,https://example.com,secondary",
    ].join("\n");
    const parsed = parseAiCandidatesCsv(csv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const rows = mergeAiCandidates(parsed.rows);
    expect(rows.every((r) => r.state === "ai_candidate")).toBe(true);
    const map = cellsToScoreMap(toDataCells(rows), "PPAD");
    expect(Object.keys(map)).toHaveLength(0);

    verifyCandidate(rows[0]!.id, "correct", "CA");
    const after = cellsToScoreMap(
      toDataCells(
        // re-read via merge of empty to get store — use verify return
        verifyCandidate(rows[1]!.id, "no_source", "CA"),
      ),
      "PPAD",
    );
    expect(after.CHE).toBe(8.5);
    expect(after.DEU).toBeUndefined();
  });
});
