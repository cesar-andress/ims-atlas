import { describe, expect, it } from "vitest";
import type { DemoPanel } from "../ranking/demoPanel";
import { panelValueAt } from "./panelValueAt";

const panel = {
  origin: "ESP",
  hs: "09",
  year: 2024,
  candidates: ["DEU", "FRA"],
  variables: [
    { id: "DIST", factor: "access", direction: "cost" as const },
    { id: "PLI", factor: "demand", direction: "cost" as const },
  ],
  values: [
    [1850, 110],
    [1050, null],
  ],
  importVolume: {},
  coveragePct: {},
  goldenImportOrder: [],
  excludedByod: [],
  notes: [],
  synthetic: true,
  illustrative: false,
} satisfies DemoPanel;

describe("panelValueAt", () => {
  it("reads a finite panel cell with a source hint", () => {
    const hit = panelValueAt(panel, "DEU", "DIST");
    expect(hit?.value).toBe(1850);
    expect(hit?.sourceHint).toMatch(/DIST/);
    expect(hit?.sourceHint).toMatch(/ESP/);
  });

  it("returns null for missing candidate, variable, or null cell", () => {
    expect(panelValueAt(panel, "ITA", "DIST")).toBeNull();
    expect(panelValueAt(panel, "DEU", "LANG")).toBeNull();
    expect(panelValueAt(panel, "FRA", "PLI")).toBeNull();
    expect(panelValueAt(null, "DEU", "DIST")).toBeNull();
  });
});
