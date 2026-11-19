import { describe, expect, it } from "vitest";
import {
  createEmptyProject,
  migrateToAtlasProject,
  parseAtlasProject,
  serializeAtlasProject,
} from "./projectModel";

describe("projectModel", () => {
  it("migrates legacy ProjectFile to v2", () => {
    const legacy = {
      kind: "ims-atlas-project",
      savedAt: "2026-01-01T00:00:00.000Z",
      label: "Calzado COL",
      config: { v: 1, view: "ranking", origin: "COL", hs: "64", year: 2023 },
    };
    const p = migrateToAtlasProject(legacy);
    expect(p.schemaVersion).toBe(2);
    expect(p.name).toBe("Calzado COL");
    expect(p.config.origin).toBe("COL");
    expect(p.yearFrom).toBe(2023);
  });

  it("round-trips serialize/parse", () => {
    const p = createEmptyProject({
      name: "Proyecto X — Calzado COL 2015–2023",
      config: { v: 1, view: "builder", origin: "COL", hs: "64", year: 2023 },
      yearFrom: 2015,
      yearTo: 2023,
    });
    const again = parseAtlasProject(JSON.parse(serializeAtlasProject(p)));
    expect(again.name).toBe(p.name);
    expect(again.yearFrom).toBe(2015);
    expect(again.yearTo).toBe(2023);
  });

  it("rejects garbage with plain message", () => {
    expect(() => migrateToAtlasProject({ foo: 1 })).toThrow(/Unrecognised|kind/i);
  });
});
