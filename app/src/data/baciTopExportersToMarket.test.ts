import { describe, expect, it } from "vitest";
import { loadBaciTopExportersToMarket } from "./baciTopExportersToMarket";

describe("loadBaciTopExportersToMarket", () => {
  it("accepts HS4 café codes (uses HS2 chapter 09)", async () => {
    const r = await loadBaciTopExportersToMarket({
      hs: "0901",
      year: 2024,
      importer: "DEU",
      topN: 3,
    });
    // Without DuckDB release bytes in unit tests, expect unavailable — not a hard reject.
    expect(r.hs2).toBe("09");
    expect(r.importer).toBe("DEU");
    expect(["baci_release", "unavailable"]).toContain(r.source);
  });
});
