/**
 * DuckDB-WASM data layer: load SPEC §3 parquet over HTTP and run typed queries.
 * Pure browser API; unit tests use {@link createMemoryDataClient}.
 */

import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { releaseUrl } from "../dataConfig";
import type { CountryYearRow, DataStatus } from "./types";

export type AtlasDataClient = {
  getStatus(): DataStatus;
  getError(): string | undefined;
  init(): Promise<void>;
  /** Register release parquet tables (HTTP range-capable when hosted). */
  loadRelease(opts?: { basePath?: string }): Promise<void>;
  queryCountryYear(opts?: {
    variableIds?: string[];
    year?: number;
    limit?: number;
  }): Promise<CountryYearRow[]>;
  querySql(sql: string): Promise<Record<string, unknown>[]>;
};

let duckdbModulePromise: Promise<typeof import("@duckdb/duckdb-wasm")> | null =
  null;

async function loadDuckdbModule() {
  if (!duckdbModulePromise) {
    duckdbModulePromise = import("@duckdb/duckdb-wasm");
  }
  return duckdbModulePromise;
}

export function createDuckDbClient(): AtlasDataClient {
  let status: DataStatus = "idle";
  let error: string | undefined;
  let db: AsyncDuckDB | null = null;
  let conn: AsyncDuckDBConnection | null = null;
  let releaseLoaded = false;

  return {
    getStatus: () => status,
    getError: () => error,
    async init() {
      if (db) return;
      status = "loading";
      error = undefined;
      try {
        const duckdb = await loadDuckdbModule();
        const bundles = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(bundles);
        const workerUrl = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker!}");`], {
            type: "text/javascript",
          }),
        );
        const worker = new Worker(workerUrl);
        const logger = new duckdb.ConsoleLogger();
        db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        conn = await db.connect();
        status = "ready";
        URL.revokeObjectURL(workerUrl);
      } catch (err) {
        status = "error";
        error = err instanceof Error ? err.message : String(err);
        throw err;
      }
    },
    async loadRelease(opts) {
      if (!conn) await this.init();
      if (!conn) throw new Error("DuckDB not initialised");
      status = "loading";
      const base = opts?.basePath ?? releaseUrl();
      const countryUrl = `${base}/country_year.parquet`;
      const bilateralUrl = `${base}/bilateral_year.parquet`;
      try {
        await conn.query(`
          CREATE OR REPLACE TABLE country_year AS
          SELECT * FROM read_parquet('${countryUrl}');
        `);
        await conn.query(`
          CREATE OR REPLACE TABLE bilateral_year AS
          SELECT * FROM read_parquet('${bilateralUrl}');
        `);
        releaseLoaded = true;
        status = "ready";
      } catch (err) {
        status = "error";
        error = err instanceof Error ? err.message : String(err);
        throw err;
      }
    },
    async queryCountryYear(opts = {}) {
      if (!conn) await this.init();
      if (!conn) throw new Error("DuckDB not initialised");
      if (!releaseLoaded) await this.loadRelease();
      const limit = opts.limit ?? 10_000;
      const clauses: string[] = [];
      if (opts.year !== undefined) clauses.push(`year = ${opts.year}`);
      if (opts.variableIds?.length) {
        const list = opts.variableIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
        clauses.push(`variable_id IN (${list})`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const sql = `
        SELECT iso3, year, variable_id, value, flag_imputed, flag_locf
        FROM country_year
        ${where}
        LIMIT ${limit}
      `;
      const table = await conn.query(sql);
      return table.toArray().map((row) => {
        const r = row.toJSON() as Record<string, unknown>;
        return {
          iso3: String(r.iso3),
          year: Number(r.year),
          variable_id: String(r.variable_id),
          value: r.value === null || r.value === undefined ? null : Number(r.value),
          flag_imputed: Boolean(r.flag_imputed),
          flag_locf: Boolean(r.flag_locf),
        };
      });
    },
    async querySql(sql: string) {
      if (!conn) await this.init();
      if (!conn) throw new Error("DuckDB not initialised");
      const table = await conn.query(sql);
      return table.toArray().map((row) => row.toJSON() as Record<string, unknown>);
    },
  };
}

/** In-memory client for unit tests (no WASM). */
export function createMemoryDataClient(
  seed: CountryYearRow[] = [],
): AtlasDataClient {
  let status: DataStatus = "idle";
  const rows = [...seed];
  return {
    getStatus: () => status,
    getError: () => undefined,
    async init() {
      status = "ready";
    },
    async loadRelease() {
      status = "ready";
    },
    async queryCountryYear(opts = {}) {
      let out = rows;
      if (opts.year !== undefined) out = out.filter((r) => r.year === opts.year);
      if (opts.variableIds?.length) {
        const set = new Set(opts.variableIds);
        out = out.filter((r) => set.has(r.variable_id));
      }
      return out.slice(0, opts.limit ?? 10_000);
    },
    async querySql() {
      return rows as unknown as Record<string, unknown>[];
    },
  };
}
