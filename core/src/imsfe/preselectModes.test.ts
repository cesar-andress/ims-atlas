import { describe, expect, it } from "vitest";
import { dualPreselect, parseHsCode, warnFewImportersAtHs6 } from "./preselectModes.js";

describe("preselect modes (A7)", () => {
  it("parses HS levels", () => {
    expect(parseHsCode("64").level).toBe(2);
    expect(parseHsCode("15.09").level).toBe(4);
    expect(parseHsCode("6403.99").level).toBe(6);
  });

  it("warns on few HS-6 importers", () => {
    expect(warnFewImportersAtHs6(3, 6)).toMatch(/HS-6/);
    expect(warnFewImportersAtHs6(3, 2)).toBeNull();
  });

  it("builds A/B overlap and keeps origin out by default", () => {
    const r = dualPreselect({
      importRows: [
        { iso3: "USA", importValue: 100 },
        { iso3: "DEU", importValue: 80 },
        { iso3: "ESP", importValue: 10 },
      ],
      opennessRows: [
        { iso3: "DEU", eoc: 0.9 },
        { iso3: "CHE", eoc: 0.8 },
        { iso3: "ESP", eoc: 0.1 },
      ],
      importMode: "top_n",
      topN: 2,
      pick: "union",
      originIso3: "ESP",
      includeOrigin: false,
    });
    expect(r.overlap).toContain("DEU");
    expect(r.chosen).not.toContain("ESP");
    expect(r.exclusionReasons.ESP).toMatch(/origin/);
  });
});
