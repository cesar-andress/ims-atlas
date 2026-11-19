import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addByodVariable,
  clearByodVariables,
  listByodVariables,
  parseByodCsv,
} from "./byodStore";

afterEach(() => {
  clearByodVariables();
});

describe("parseByodCsv", () => {
  it("accepts valid rows and rejects bad iso3", () => {
    const r = parseByodCsv("iso3,year,value\nESP,2020,1.5\nXX,2020,2\nFRA,2021,3");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(2);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("requires header columns", () => {
    const r = parseByodCsv("a,b\n1,2");
    expect(r.ok).toBe(false);
  });
});

describe("byodStore local-only", () => {
  it("stores variables without calling fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    addByodVariable({
      id: "TESTV",
      label: "Test",
      direction: "benefit",
      factor: "ECON",
      rows: [{ iso3: "ESP", year: 2020, value: 1 }],
    });
    expect(listByodVariables().map((v) => v.id)).toEqual(["TESTV"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
