/**
 * Load distinct years with non-null values for one variable × country
 * from the published release (DuckDB). Never fabricates years.
 */

import {
  getAtlasDataClient,
  type AtlasDataClient,
} from "./duckdbClient";

/** Product-level variables live in country_product (need HS chapter). */
export const PRODUCT_COVERAGE_VAR_IDS = new Set([
  "IMPV",
  "IMPC",
  "GRW",
  "HHI",
  "ASIASH",
  "REEXP",
  "UVGAP",
  "PPAD",
]);

const BILATERAL_COVERAGE_VAR_IDS = new Set(["DIST", "LANG", "FTA"]);

export type CountryYearsResult =
  | { status: "ok"; years: number[]; panel: "country_year" | "country_product" }
  | {
      status: "unavailable";
      reason: "needs_hs" | "bilateral" | "not_in_release" | "error";
      detail?: string;
    };

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function hs2Of(hs: string): string {
  const digits = hs.replace(/\D/g, "");
  return digits.slice(0, 2).padStart(2, "0");
}

function hsLevelAndCode(hs: string): { level: string; code: string } {
  const digits = hs.replace(/\D/g, "");
  if (digits.length <= 2) return { level: "hs2", code: hs2Of(hs) };
  if (digits.length <= 4) return { level: "hs4", code: digits };
  return { level: "hs6", code: digits };
}

function yearsFromRows(rows: Record<string, unknown>[]): number[] {
  const years = new Set<number>();
  for (const row of rows) {
    const y = Number(row.year);
    if (Number.isFinite(y)) years.add(Math.trunc(y));
  }
  return [...years].sort((a, b) => a - b);
}

export async function loadVariableCountryYears(opts: {
  variableId: string;
  iso3: string;
  /** Required for product variables (IMPV, …). */
  hs?: string | null;
  client?: AtlasDataClient;
}): Promise<CountryYearsResult> {
  const variableId = opts.variableId.trim();
  const iso3 = opts.iso3.trim().toUpperCase();
  if (!variableId || !/^[A-Z]{3}$/.test(iso3)) {
    return { status: "unavailable", reason: "not_in_release" };
  }
  if (BILATERAL_COVERAGE_VAR_IDS.has(variableId)) {
    return { status: "unavailable", reason: "bilateral" };
  }

  const client = opts.client ?? getAtlasDataClient();
  try {
    await client.init();
    await client.loadRelease();

    if (PRODUCT_COVERAGE_VAR_IDS.has(variableId)) {
      const hs = (opts.hs ?? "").trim();
      if (!hs) return { status: "unavailable", reason: "needs_hs" };
      const hs2 = hs2Of(hs);
      const { level, code } = hsLevelAndCode(hs);
      const ok = await client.loadCountryProductChapter(hs2, {
        variableIds: [variableId],
      });
      if (!ok) {
        return { status: "unavailable", reason: "not_in_release" };
      }
      const table = `country_product_hs2_${hs2}`;
      const rows = await client.querySql(`
        SELECT DISTINCT year
        FROM ${table}
        WHERE variable_id = '${escapeSql(variableId)}'
          AND iso3 = '${escapeSql(iso3)}'
          AND hs_level = '${escapeSql(level)}'
          AND CAST(hs_code AS VARCHAR) = '${escapeSql(code)}'
          AND value IS NOT NULL
        ORDER BY year
      `);
      return {
        status: "ok",
        years: yearsFromRows(rows),
        panel: "country_product",
      };
    }

    const rows = await client.querySql(`
      SELECT DISTINCT year
      FROM country_year
      WHERE variable_id = '${escapeSql(variableId)}'
        AND iso3 = '${escapeSql(iso3)}'
        AND value IS NOT NULL
      ORDER BY year
    `);
    const years = yearsFromRows(rows);
    if (years.length === 0) {
      const any = await client.querySql(`
        SELECT 1 AS hit
        FROM country_year
        WHERE variable_id = '${escapeSql(variableId)}'
        LIMIT 1
      `);
      if (!any.length) {
        return { status: "unavailable", reason: "not_in_release" };
      }
    }
    return { status: "ok", years, panel: "country_year" };
  } catch (err) {
    return {
      status: "unavailable",
      reason: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
