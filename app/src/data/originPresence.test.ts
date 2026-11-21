import { describe, expect, it } from "vitest";
import { loadOriginPresence } from "./originPresence";

describe("loadOriginPresence", () => {
  it("returns unavailable for invalid scope without touching DuckDB trade", async () => {
    const r = await loadOriginPresence({
      hs: "6",
      year: 2024,
      origin: "COL",
      importers: ["USA"],
    });
    expect(r.source).toBe("unavailable");
    expect(r.byIso).toEqual({});
  });

  it("returns unavailable when importer list is empty", async () => {
    const r = await loadOriginPresence({
      hs: "64",
      year: 2024,
      origin: "COL",
      importers: [],
    });
    expect(r.source).toBe("unavailable");
  });
});
