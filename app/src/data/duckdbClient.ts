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
  /** Trade rows for one HS2 chapter (`trade/hs2=…/part.parquet`). No-op if missing. */
  loadTradeChapter(hs2: string, opts?: { basePath?: string }): Promise<boolean>;
  /** Country–product panel slice for one HS2 chapter. No-op if missing. */
  loadCountryProductChapter(
    hs2: string,
    opts?: { basePath?: string },
  ): Promise<boolean>;
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
  const loadedTradeHs2 = new Set<string>();
  const loadedCountryProductHs2 = new Set<string>();

  async function registerParquetTable(
    table: string,
    url: string,
  ): Promise<void> {
    if (!conn) throw new Error("DuckDB not initialised");
    await conn.query(`
      CREATE OR REPLACE TABLE ${table} AS
      SELECT * FROM read_parquet('${url.replace(/'/g, "''")}');
    `);
  }

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
    async loadTradeChapter(hs2, opts) {
      if (!conn) await this.init();
      if (!conn) throw new Error("DuckDB not initialised");
      const key = hs2.padStart(2, "0").slice(0, 2);
      if (loadedTradeHs2.has(key)) return true;
      const base = opts?.basePath ?? releaseUrl();
      const url = `${base}/trade/hs2=${key}/part.parquet`;
      try {
        await registerParquetTable(`trade_hs2_${key}`, url);
        loadedTradeHs2.add(key);
        return true;
      } catch {
        return false;
      }
    },
    async loadCountryProductChapter(hs2, opts) {
      if (!conn) await this.init();
      if (!conn) throw new Error("DuckDB not initialised");
      const key = hs2.padStart(2, "0").slice(0, 2);
      if (loadedCountryProductHs2.has(key)) return true;
      const base = opts?.basePath ?? releaseUrl();
      const chapter = `${base}/country_product/hs2=${key}`;
      const table = `country_product_hs2_${key}`;
      try {
        // Fine-partitioned releases expose index.json (year × variable_id parts).
        const indexRes = await fetch(`${chapter}/index.json`);
        if (indexRes.ok) {
          const index = (await indexRes.json()) as { parts?: string[] };
          const parts = (index.parts ?? []).map(
            (rel) => `${chapter}/${rel}`.replace(/'/g, "''"),
          );
          if (!parts.length) return false;
          const list = parts.map((u) => `'${u}'`).join(", ");
          await conn.query(`
            CREATE OR REPLACE TABLE ${table} AS
            SELECT * FROM read_parquet([${list}]);
          `);
        } else {
          await registerParquetTable(table, `${chapter}/part.parquet`);
        }
        loadedCountryProductHs2.add(key);
        return true;
      } catch {
        return false;
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
    async loadTradeChapter() {
      return false;
    },
    async loadCountryProductChapter() {
      return false;
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
