import { describe, expect, it } from "vitest";
import {
  computeYearGaps,
  formatYearRanges,
  searchCountries,
} from "./countryYearGaps";

describe("computeYearGaps", () => {
  it("lists present and missing years inside the published window", () => {
    const report = computeYearGaps([2012, 2013, 2024], {
      min: 2010,
      max: 2026,
    });
    expect(report.present).toEqual([2012, 2013, 2024]);
    expect(report.missing).toEqual([
      2010, 2011, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
      2025, 2026,
    ]);
  });

  it("ignores years outside the window", () => {
    const report = computeYearGaps([1980, 2015, 2099], {
      min: 2010,
      max: 2020,
    });
    expect(report.present).toEqual([2015]);
    expect(report.missing).toContain(2010);
    expect(report.missing).not.toContain(1980);
  });
});

describe("formatYearRanges", () => {
  it("collapses consecutive years", () => {
    expect(formatYearRanges([2012, 2013, 2014, 2020, 2022])).toBe(
      "2012–2014, 2020, 2022",
    );
    expect(formatYearRanges([])).toBe("");
  });
});

describe("searchCountries", () => {
  it("matches by ISO3 and by localized name", () => {
    const byCode = searchCountries("col", "es");
    expect(byCode.some((h) => h.iso3 === "COL")).toBe(true);

    const byName = searchCountries("españa", "es");
    expect(byName.some((h) => h.iso3 === "ESP")).toBe(true);

    expect(searchCountries("", "es")).toEqual([]);
  });
});
