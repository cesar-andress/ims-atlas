import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseByodCsv } from "./byodStore";
import {
  BYOD_TEMPLATE_CSV,
  BYOD_TEMPLATE_FIELDS,
  BYOD_TEMPLATE_FILENAME,
  byodTemplatePublicPath,
} from "./byodTemplate";

const publicCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public",
  BYOD_TEMPLATE_FILENAME,
);

describe("BYOD upload template", () => {
  it("uses the importer column names (iso3, year, value, optional iso3_d)", () => {
    const header = BYOD_TEMPLATE_CSV.split("\n")[0]!.toLowerCase().split(",");
    expect(header).toEqual(["iso3", "year", "value", "iso3_d"]);
    expect(BYOD_TEMPLATE_FIELDS.map((f) => f.name)).toEqual([
      "iso3",
      "year",
      "value",
      "iso3_d",
    ]);
    expect(BYOD_TEMPLATE_FIELDS.filter((f) => f.required).map((f) => f.name)).toEqual([
      "iso3",
      "year",
      "value",
    ]);
  });

  it("parses with parseByodCsv (same contract as Subir mis datos)", () => {
    const parsed = parseByodCsv(BYOD_TEMPLATE_CSV);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows.length).toBe(6);
    expect(parsed.warnings).toEqual([]);
    const country = parsed.rows.filter((r) => r.iso3_d === undefined);
    const bilateral = parsed.rows.filter((r) => r.iso3_d !== undefined);
    expect(country).toHaveLength(3);
    expect(bilateral).toHaveLength(3);
    expect(country[0]).toMatchObject({ iso3: "COL", year: 2022, value: 72.5 });
    expect(bilateral[0]).toMatchObject({
      iso3: "COL",
      year: 2022,
      value: 1.25,
      iso3_d: "USA",
    });
  });

  it("keeps public/plantilla-datos-propios.csv in sync with the module", () => {
    const onDisk = readFileSync(publicCsvPath, "utf8")
      .replace(/^\uFEFF/, "")
      .trim();
    expect(onDisk).toBe(BYOD_TEMPLATE_CSV.trim());
    expect(BYOD_TEMPLATE_FILENAME).toBe("plantilla-datos-propios.csv");
    expect(byodTemplatePublicPath("/")).toBe("/plantilla-datos-propios.csv");
    expect(byodTemplatePublicPath("/ims-atlas/")).toBe(
      "/ims-atlas/plantilla-datos-propios.csv",
    );
  });
});
