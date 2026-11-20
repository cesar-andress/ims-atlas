/**
 * DuckDB-WASM data layer: load SPEC §3 parquet over HTTP and run typed queries.
 * Pure browser API; unit tests use {@link createMemoryDataClient}.
 *
 * Performance rules (browser WASM heap is tiny vs desktop DuckDB):
 * - Never materialise bilateral_year (≈4.8M rows) into a TABLE on load.
 * - country_year is small → TABLE is fine.
 * - Trade / country_product: register URLs or VIEWs; push filters into
 *   `read_parquet(...)` so HTTP range + parquet stats can skip work.
 * - One shared client ({@link getAtlasDataClient}) so WASM is not re-booted.
 */

import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { releaseUrl } from "../dataConfig";
import type { CountryYearRow, DataStatus } from "./types";

export type AtlasDataClient = {
  getStatus(): DataStatus;
  getError(): string | undefined;
  init(): Promise<void>;
  /**
   * Register release tables. Loads country_year eagerly; bilateral_year is a
   * VIEW over HTTP parquet (no full materialisation) unless
   * `materialiseBilateral: true` (expert / diagnostics only).
   */
  loadRelease(opts?: {
    basePath?: string;
    materialiseBilateral?: boolean;
  }): Promise<void>;
  /** Ensure trade chapter URL is reachable (no full-table materialisation). */
  loadTradeChapter(hs2: string, opts?: { basePath?: string }): Promise<boolean>;
  /**
   * Country–product panel for one HS2 chapter. Prefer `year` / `variableIds`
   * so only matching hive parts are opened (chapters have dozens of parts).
   */
  loadCountryProductChapter(
    hs2: string,
    opts?: {
      basePath?: string;
      year?: number;
      variableIds?: string[];
    },
  ): Promise<boolean>;
  /** Absolute URL of a registered trade chapter parquet, if loaded. */
  tradeChapterUrl(hs2: string): string | undefined;
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

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function hs2Key(hs2: string): string {
  return hs2.padStart(2, "0").slice(0, 2);
}

/** Probe that a release parquet is reachable without downloading the body. */
async function parquetExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) return true;
    // Some static hosts omit HEAD; fall back to a 1-byte range GET.
    const ranged = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    return ranged.ok || ranged.status === 206;
  } catch {
    return false;
  }
}

export function createDuckDbClient(): AtlasDataClient {
  let status: DataStatus = "idle";
  let error: string | undefined;
  let db: AsyncDuckDB | null = null;
  let conn: AsyncDuckDBConnection | null = null;
  let initPromise: Promise<void> | null = null;
  let releaseBase: string | null = null;
  let bilateralMaterialised = false;
  let releasePromise: Promise<void> | null = null;
  let releasePromiseKey: string | null = null;
  const tradeUrls = new Map<string, string>();
  const countryProductKeys = new Set<string>();

  async function ensureConn(): Promise<AsyncDuckDBConnection> {
    if (!conn) await api.init();
    if (!conn) throw new Error("DuckDB not initialised");
    return conn;
  }

  const api: AtlasDataClient = {
    getStatus: () => status,
    getError: () => error,
    async init() {
      if (db && conn) return;
      if (initPromise) return initPromise;
      initPromise = (async () => {
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
          db = null;
          conn = null;
          throw err;
        } finally {
          initPromise = null;
        }
      })();
      return initPromise;
    },
    async loadRelease(opts) {
      const connection = await ensureConn();
      const base = opts?.basePath ?? releaseUrl();
      const materialiseBilateral = opts?.materialiseBilateral === true;
      const wantKey = `${base}|mat=${materialiseBilateral ? 1 : 0}`;
      // Idempotent: same base already registered at the requested materialisation level.
      if (
        releaseBase === base &&
        (!materialiseBilateral || bilateralMaterialised)
      ) {
        return;
      }
      if (releasePromise && releasePromiseKey === wantKey) {
        return releasePromise;
      }
      releasePromiseKey = wantKey;
      releasePromise = (async () => {
        status = "loading";
        const countryUrl = `${base}/country_year.parquet`;
        const bilateralUrl = `${base}/bilateral_year.parquet`;
        try {
          // Small panel (~18k rows): materialise once for snappy SQL console.
          await connection.query(`
            CREATE OR REPLACE TABLE country_year AS
            SELECT * FROM read_parquet('${escapeSqlString(countryUrl)}');
          `);
          if (materialiseBilateral) {
            // Explicit opt-in only — expands to ~250 MiB WASM heap.
            await connection.query(`
              CREATE OR REPLACE TABLE bilateral_year AS
              SELECT * FROM read_parquet('${escapeSqlString(bilateralUrl)}');
            `);
            bilateralMaterialised = true;
          } else {
            // VIEW: LIMIT / filtered queries avoid loading all 4.8M rows up front.
            await connection.query(`
              CREATE OR REPLACE VIEW bilateral_year AS
              SELECT * FROM read_parquet('${escapeSqlString(bilateralUrl)}');
            `);
            bilateralMaterialised = false;
          }
          releaseBase = base;
          status = "ready";
        } catch (err) {
          status = "error";
          error = err instanceof Error ? err.message : String(err);
          releaseBase = null;
          bilateralMaterialised = false;
          throw err;
        } finally {
          releasePromise = null;
          releasePromiseKey = null;
        }
      })();
      return releasePromise;
    },
    async loadTradeChapter(hs2, opts) {
      await ensureConn();
      const key = hs2Key(hs2);
      if (tradeUrls.has(key)) return true;
      const base = opts?.basePath ?? releaseUrl();
      const url = `${base}/trade/hs2=${key}/part.parquet`;
      const ok = await parquetExists(url);
      if (!ok) return false;
      // URL only — aggregations call read_parquet(url) with a year filter.
      // Creating a VIEW here would still open the chapter on register.
      tradeUrls.set(key, url);
      return true;
    },
    tradeChapterUrl(hs2) {
      return tradeUrls.get(hs2Key(hs2));
    },
    async loadCountryProductChapter(hs2, opts) {
      const connection = await ensureConn();
      const key = hs2Key(hs2);
      const year = opts?.year;
      const variableIds = opts?.variableIds;
      const sliceKey = `${key}|y=${year ?? "*"}|v=${(variableIds ?? []).slice().sort().join(",") || "*"}`;
      if (countryProductKeys.has(sliceKey)) return true;
      const base = opts?.basePath ?? releaseUrl();
      const chapter = `${base}/country_product/hs2=${key}`;
      const table = `country_product_hs2_${key}`;
      try {
        const indexRes = await fetch(`${chapter}/index.json`);
        if (indexRes.ok) {
          const index = (await indexRes.json()) as { parts?: string[] };
          let parts = index.parts ?? [];
          if (year !== undefined) {
            const prefix = `year=${year}/`;
            parts = parts.filter((rel) => rel.startsWith(prefix));
          }
          if (variableIds?.length) {
            const wanted = new Set(variableIds);
            parts = parts.filter((rel) => {
              const m = /variable_id=([^/]+)/.exec(rel);
              return m ? wanted.has(m[1]!) : false;
            });
          }
          if (!parts.length) return false;
          const list = parts
            .map((rel) => `'${escapeSqlString(`${chapter}/${rel}`)}'`)
            .join(", ");
          // VIEW over the filtered part list — no CREATE TABLE AS full copy.
          await connection.query(`
            CREATE OR REPLACE VIEW ${table} AS
            SELECT * FROM read_parquet([${list}]);
          `);
        } else {
          const url = `${chapter}/part.parquet`;
          if (!(await parquetExists(url))) return false;
          await connection.query(`
            CREATE OR REPLACE VIEW ${table} AS
            SELECT * FROM read_parquet('${escapeSqlString(url)}');
          `);
        }
        countryProductKeys.add(sliceKey);
        return true;
      } catch {
        return false;
      }
    },
    async queryCountryYear(opts = {}) {
      const connection = await ensureConn();
      if (!releaseBase) await api.loadRelease();
      const limit = opts.limit ?? 10_000;
      const clauses: string[] = [];
      if (opts.year !== undefined) clauses.push(`year = ${opts.year}`);
      if (opts.variableIds?.length) {
        const list = opts.variableIds
          .map((id) => `'${escapeSqlString(id)}'`)
          .join(",");
        clauses.push(`variable_id IN (${list})`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const sql = `
        SELECT iso3, year, variable_id, value, flag_imputed, flag_locf
        FROM country_year
        ${where}
        LIMIT ${limit}
      `;
      const table = await connection.query(sql);
      return table.toArray().map((row) => {
        const r = row.toJSON() as Record<string, unknown>;
        return {
          iso3: String(r.iso3),
          year: Number(r.year),
          variable_id: String(r.variable_id),
          value:
            r.value === null || r.value === undefined ? null : Number(r.value),
          flag_imputed: Boolean(r.flag_imputed),
          flag_locf: Boolean(r.flag_locf),
        };
      });
    },
    async querySql(sql: string) {
      const connection = await ensureConn();
      const table = await connection.query(sql);
      return table
        .toArray()
        .map((row) => row.toJSON() as Record<string, unknown>);
    },
  };

  return api;
}

let sharedClient: AtlasDataClient | null = null;

/** Process-wide DuckDB-WASM client (avoids re-downloading the WASM binary). */
export function getAtlasDataClient(): AtlasDataClient {
  if (!sharedClient) sharedClient = createDuckDbClient();
  return sharedClient;
}

/** Reset the shared client (tests only). */
export function resetAtlasDataClientForTests(): void {
  sharedClient = null;
}

/** In-memory client for unit tests (no WASM). */
export function createMemoryDataClient(
  seed: CountryYearRow[] = [],
): AtlasDataClient {
  let status: DataStatus = "idle";
  const rows = [...seed];
  const tradeUrls = new Map<string, string>();
  return {
    getStatus: () => status,
    getError: () => undefined,
    async init() {
      status = "ready";
    },
    async loadRelease() {
      status = "ready";
    },
    async loadTradeChapter(hs2) {
      // Memory client has no parquet; mark missing.
      void hs2;
      return false;
    },
    tradeChapterUrl(hs2) {
      return tradeUrls.get(hs2Key(hs2));
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
