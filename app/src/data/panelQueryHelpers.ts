/**
 * Pure helpers for project-panel DuckDB SQL (performance-critical filters).
 */

/** Escape a string for use inside a single-quoted SQL literal. */
export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/** Build `('A','B')` for SQL IN lists. Empty → `('__none__')` (matches nothing). */
export function sqlInList(values: readonly string[]): string {
  if (!values.length) return `('__none__')`;
  return `(${values.map((v) => `'${escapeSqlLiteral(v)}'`).join(",")})`;
}

/** Inclusive LOCF window years ending at `year` (length = lag + 1). */
export function locfYears(year: number, lag: number): number[] {
  const out: number[] = [];
  for (let y = year - lag; y <= year; y++) out.push(y);
  return out;
}

/**
 * Filter hive part paths under country_product (`year=YYYY/variable_id=ID/…`).
 */
export function filterCountryProductParts(
  parts: readonly string[],
  opts?: { years?: readonly number[]; variableIds?: readonly string[] },
): string[] {
  let out = [...parts];
  if (opts?.years?.length) {
    const prefixes = opts.years.map((y) => `year=${y}/`);
    out = out.filter((rel) => prefixes.some((p) => rel.startsWith(p)));
  }
  if (opts?.variableIds?.length) {
    const wanted = new Set(opts.variableIds);
    out = out.filter((rel) => {
      const m = /variable_id=([^/]+)/.exec(rel);
      return m ? wanted.has(m[1]!) : false;
    });
  }
  return out;
}

/**
 * LOCF collapse in SQL: one row per (iso3, variable_id) with latest year ≤ t.
 * `isoColumn` is the destination ISO column name (`iso3` or `iso3_d`).
 */
export function locfSelectSql(opts: {
  from: string;
  isoColumn: string;
  yearMax: number;
  yearMin: number;
  variableIds: readonly string[];
  isoFilter?: readonly string[];
  extraWhere?: string;
}): string {
  const vars = sqlInList([...opts.variableIds]);
  const isoClause =
    opts.isoFilter && opts.isoFilter.length
      ? ` AND ${opts.isoColumn} IN ${sqlInList(opts.isoFilter)}`
      : "";
  const extra = opts.extraWhere ? ` AND (${opts.extraWhere})` : "";
  return `
    SELECT
      ${opts.isoColumn} AS iso3,
      variable_id,
      arg_max(value, year) AS value,
      max(year) AS year
    FROM ${opts.from}
    WHERE year <= ${Number(opts.yearMax)}
      AND year >= ${Number(opts.yearMin)}
      AND variable_id IN ${vars}
      ${isoClause}
      ${extra}
    GROUP BY ${opts.isoColumn}, variable_id
  `;
}
