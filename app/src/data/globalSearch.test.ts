import { describe, expect, it } from "vitest";
import { runGlobalSearch } from "./globalSearch";

describe("globalSearch", () => {
  it("finds ISO3, variables and HS", () => {
    const hits = runGlobalSearch(
      "col",
      {
        variables: [
          {
            id: "GDPPC",
            name: { en: "GDP per capita", es: "PIB per cápita" },
            factor: "macro_risk",
            source_ids: ["wdi"],
            licence_ids: ["CC-BY-4.0"],
            redistributable: true,
          },
        ],
        sources: [{ id: "wdi", name: "World Bank WDI" }],
        projects: [{ id: "1", name: "Calzado COL", updatedAt: "", createdAt: "" }],
      },
      "en",
    );
    expect(hits.some((h) => h.group === "countries" && h.id === "COL")).toBe(true);
    expect(hits.some((h) => h.group === "projects")).toBe(true);
  });

  it("returns empty for blank query", () => {
    expect(runGlobalSearch("  ", { variables: [], sources: [], projects: [] }, "en")).toEqual(
      [],
    );
  });
});
