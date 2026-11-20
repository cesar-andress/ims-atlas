import { describe, expect, it } from "vitest";
import type { CatalogVariable } from "./types";
import {
  aliasCollisionsFromCatalog,
  variableDataStatus,
} from "./variableDataStatus";

function v(partial: Partial<CatalogVariable> & { id: string }): CatalogVariable {
  return {
    name: { en: partial.id, es: partial.id },
    factor: "demand",
    source_ids: ["baci"],
    licence_ids: ["etalab-2.0"],
    ...partial,
  };
}

describe("variableDataStatus (EXTRA-5)", () => {
  it("marks none when coverage is missing", () => {
    expect(variableDataStatus(v({ id: "FAIRS_N" })).kind).toBe("none");
  });

  it("marks complete when coverage is strong", () => {
    expect(
      variableDataStatus(
        v({
          id: "IMPV",
          coverage_stats: {
            n_countries: 200,
            year_min: 2012,
            year_max: 2024,
            coverage_pct: 92,
          },
        }),
        { year: 2024 },
      ).kind,
    ).toBe("complete");
  });

  it("marks partial when pct is low", () => {
    expect(
      variableDataStatus(
        v({
          id: "LPIN",
          coverage_stats: {
            n_countries: 169,
            year_min: 2007,
            year_max: 2022,
            coverage_pct: 13.7,
          },
        }),
        { year: 2024 },
      ).kind,
    ).toBe("partial");
  });

  it("marks team when gate is byod_only and no coverage", () => {
    expect(
      variableDataStatus(
        v({ id: "X", gate_decision: "byod_only", audience_public: false }),
      ).kind,
    ).toBe("team");
  });
});

describe("alias collisions (EXTRA-10)", () => {
  it("flags CLI+PLI and alias_of pairs", () => {
    const cat = [
      v({ id: "CLI", alias_of: "PLI" }),
      v({ id: "PLI" }),
      v({ id: "LPIN", alias_of: "LPI" }),
      v({ id: "LPI" }),
    ];
    expect(
      aliasCollisionsFromCatalog(new Set(["CLI", "PLI", "LPIN"]), cat),
    ).toContain("CLI+PLI");
    expect(
      aliasCollisionsFromCatalog(new Set(["LPIN", "LPI"]), cat),
    ).toContain("LPIN+LPI");
  });
});
