import { describe, expect, it } from "vitest";
import {
  escapeSqlLiteral,
  filterCountryProductParts,
  locfSelectSql,
  locfYears,
  sqlInList,
} from "./panelQueryHelpers";

describe("panelQueryHelpers", () => {
  it("escapes SQL quotes", () => {
    expect(escapeSqlLiteral("O'Brien")).toBe("O''Brien");
  });

  it("builds IN lists without empty SQL", () => {
    expect(sqlInList([])).toBe("('__none__')");
    expect(sqlInList(["ESP", "COL"])).toBe("('ESP','COL')");
  });

  it("builds LOCF year windows", () => {
    expect(locfYears(2024, 5)).toEqual([2019, 2020, 2021, 2022, 2023, 2024]);
  });

  it("filters country_product hive parts by year window and variables", () => {
    const parts = [
      "year=2024/variable_id=IMPV/part.parquet",
      "year=2023/variable_id=IMPV/part.parquet",
      "year=2018/variable_id=IMPV/part.parquet",
      "year=2024/variable_id=LPI/part.parquet",
      "year=2024/variable_id=GDPPC/part.parquet",
    ];
    expect(
      filterCountryProductParts(parts, {
        years: [2023, 2024],
        variableIds: ["IMPV", "GDPPC"],
      }),
    ).toEqual([
      "year=2024/variable_id=IMPV/part.parquet",
      "year=2023/variable_id=IMPV/part.parquet",
      "year=2024/variable_id=GDPPC/part.parquet",
    ]);
  });

  it("emits LOCF SQL that filters destinations (no 500k dump)", () => {
    const sql = locfSelectSql({
      from: "bilateral_year",
      isoColumn: "iso3_d",
      yearMax: 2024,
      yearMin: 2019,
      variableIds: ["DIST", "LANG", "FTA"],
      isoFilter: ["USA", "DEU"],
      extraWhere: "iso3_o = 'ESP'",
    });
    expect(sql).toContain("arg_max(value, year)");
    expect(sql).toContain("iso3_d IN ('USA','DEU')");
    expect(sql).toContain("iso3_o = 'ESP'");
    expect(sql).not.toMatch(/LIMIT\s+500000/i);
    expect(sql).toContain("GROUP BY iso3_d, variable_id");
  });
});
