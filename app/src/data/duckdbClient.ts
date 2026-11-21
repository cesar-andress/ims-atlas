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
 *
 * Logging: default `ConsoleLogger` (INFO) dumps every QUERY RUN as
 * `console.log(LogEntry)` — DevTools floods with expandable Objects on
 * Resultados. Always use {@link createDuckDbWasmLogger} (VoidLogger).
 */

import type {
  AsyncDuckDB,
  AsyncDuckDBConnection,
  Logger,
} from "@duckdb/duckdb-wasm";
import { releaseUrl } from "../dataConfig";
import { filterCountryProductParts } from "./panelQueryHelpers";
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
   * Country–product panel for one HS2 chapter. Prefer `year` / `years` /
   * `variableIds` so only matching hive parts are opened.
   */
  loadCountryProductChapter(
    hs2: string,
    opts?: {
      basePath?: string;
      /** Single year (legacy). Prefer `years` for LOCF windows. */
      year?: number;
      /** Inclusive year list (e.g. LOCF window). Overrides `year` when set. */
      years?: number[];
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

/** Kind of DuckDB / HTTP failure (for UI mapping; never dump raw LogEntry). */
export type AtlasDataErrorKind =
  | "http_auth"
  | "http_io"
  | "missing_table"
  | "query"
  | "init";

export class AtlasDataError extends Error {
  readonly kind: AtlasDataErrorKind;

  constructor(
    message: string,
    kind: AtlasDataErrorKind,
    options?: { cause?: unknown },
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "AtlasDataError";
    this.kind = kind;
  }
}

/**
 * Map a DuckDB / httpfs failure to a stable {@link AtlasDataError}.
 * Empty result sets are success — do not call this for “no rows”.
 */
export function classifyDuckDbError(err: unknown): AtlasDataError {
  if (err instanceof AtlasDataError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    /\b401\b/.test(lower) ||
    /\b403\b/.test(lower) ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("authentication")
  ) {
    return new AtlasDataError(
      "Data release requires an authenticated session (HTTP 401/403).",
      "http_auth",
      { cause: err },
    );
  }
  if (
    lower.includes("table with name") ||
    lower.includes("does not exist") ||
    lower.includes("catalog error") ||
    lower.includes("catalog_error") ||
    lower.includes("not find") ||
    lower.includes("no files found that match")
  ) {
    return new AtlasDataError(
      `Release table unavailable: ${msg}`,
      "missing_table",
      { cause: err },
    );
  }
  if (
    lower.includes("io error") ||
    lower.includes("http") ||
    lower.includes("failed to read") ||
    lower.includes("parquet")
  ) {
    return new AtlasDataError(
      `Could not read release parquet: ${msg}`,
      "http_io",
      { cause: err },
    );
  }
  return new AtlasDataError(msg || "DuckDB query failed", "query", {
    cause: err,
  });
}

/**
 * Quiet WASM logger. Never use default ConsoleLogger(INFO): it
 * `console.log`s every SQL LogEntry and looks like a Resultados failure flood.
 */
export function createDuckDbWasmLogger(duckdb: {
  VoidLogger: new () => Logger;
}): Logger {
  return new duckdb.VoidLogger();
}

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

/**
 * DuckDB-WASM resolves a bare "/data/…" path against its in-memory virtual
 * filesystem, not the web server ("No files found that match the pattern").
 * Always hand it an absolute http(s) URL so httpfs fetches the file.
 */
export function absoluteDataUrl(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path.replace(/\/$/, "");
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
  return new URL(path, `${origin}/`).href.replace(/\/$/, "");
}

/** Same-origin Authelia session cookies for index/HEAD probes. */
const CREDENTIALED: RequestInit = { credentials: "include" };

/**
 * Bilateral may be a single parquet or hive parts under bilateral_year/
 * (when the long table exceeds the 5 MiB SPEC budget).
 * Returns a DuckDB ``read_parquet(...)`` argument list literal.
 */
async function resolveBilateralParquetSource(base: string): Promise<string> {
  const indexUrl = `${base}/bilateral_year/index.json`;
  try {
    const indexRes = await fetch(indexUrl, {
      cache: "no-store",
      ...CREDENTIALED,
    });
    if (indexRes.ok) {
      const index = (await indexRes.json()) as { parts?: string[] };
      const parts = index.parts ?? [];
      if (parts.length) {
        const list = parts
          .map(
            (rel) =>
              `'${escapeSqlString(`${base}/bilateral_year/${rel}`)}'`,
          )
          .join(", ");
        return `[${list}]`;
      }
    }
  } catch {
    /* fall through to monolithic file */
  }
  const mono = `${base}/bilateral_year.parquet`;
  return `'${escapeSqlString(mono)}'`;
}

function hs2Key(hs2: string): string {
  return hs2.padStart(2, "0").slice(0, 2);
}

/** Probe that a release parquet is reachable without downloading the body. */
async function parquetExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", ...CREDENTIALED });
    if (head.ok) return true;
    // Some static hosts omit HEAD; fall back to a 1-byte range GET.
    const ranged = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      ...CREDENTIALED,
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
          const logger = createDuckDbWasmLogger(duckdb);
          db = new duckdb.AsyncDuckDB(logger, worker);
          await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
          conn = await db.connect();
          status = "ready";
          URL.revokeObjectURL(workerUrl);
        } catch (err) {
          const mapped = new AtlasDataError(
            err instanceof Error ? err.message : String(err),
            "init",
            { cause: err },
          );
          status = "error";
          error = mapped.message;
          db = null;
          conn = null;
          throw mapped;
        } finally {
          initPromise = null;
        }
      })();
      return initPromise;
    },
    async loadRelease(opts) {
      const connection = await ensureConn();
      const base = absoluteDataUrl(opts?.basePath ?? releaseUrl());
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
        try {
          const probe = await fetch(countryUrl, {
            method: "HEAD",
            ...CREDENTIALED,
          });
          if (probe.status === 401 || probe.status === 403) {
            throw new AtlasDataError(
              "Data release requires an authenticated session (HTTP 401/403).",
              "http_auth",
            );
          }
          if (!(await parquetExists(countryUrl))) {
            throw new AtlasDataError(
              `country_year.parquet not reachable at ${countryUrl}`,
              "http_io",
            );
          }
          // Small panel (~18k rows): materialise once for snappy SQL console.
          await connection.query(`
            CREATE OR REPLACE TABLE country_year AS
            SELECT * FROM read_parquet('${escapeSqlString(countryUrl)}');
          `);
          const bilateralSource = await resolveBilateralParquetSource(base);
          if (materialiseBilateral) {
            // Explicit opt-in only — expands to ~250 MiB WASM heap.
            await connection.query(`
              CREATE OR REPLACE TABLE bilateral_year AS
              SELECT * FROM read_parquet(${bilateralSource});
            `);
            bilateralMaterialised = true;
          } else {
            // VIEW: LIMIT / filtered queries avoid loading all rows up front.
            await connection.query(`
              CREATE OR REPLACE VIEW bilateral_year AS
              SELECT * FROM read_parquet(${bilateralSource});
            `);
            bilateralMaterialised = false;
          }
          releaseBase = base;
          status = "ready";
        } catch (err) {
          const mapped = classifyDuckDbError(err);
          status = "error";
          error = mapped.message;
          releaseBase = null;
          bilateralMaterialised = false;
          throw mapped;
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
      const base = absoluteDataUrl(opts?.basePath ?? releaseUrl());
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
      const years =
        opts?.years?.length
          ? [...opts.years].sort((a, b) => a - b)
          : opts?.year !== undefined
            ? [opts.year]
            : undefined;
      const variableIds = opts?.variableIds;
      const sliceKey = `${key}|y=${years?.join("-") ?? "*"}|v=${(variableIds ?? []).slice().sort().join(",") || "*"}`;
      if (countryProductKeys.has(sliceKey)) return true;
      const base = absoluteDataUrl(opts?.basePath ?? releaseUrl());
      const chapter = `${base}/country_product/hs2=${key}`;
      const table = `country_product_hs2_${key}`;
      try {
        const indexRes = await fetch(`${chapter}/index.json`, CREDENTIALED);
        if (indexRes.ok) {
          const index = (await indexRes.json()) as { parts?: string[] };
          const partOpts: {
            years?: readonly number[];
            variableIds?: readonly string[];
          } = {};
          if (years?.length) partOpts.years = years;
          if (variableIds?.length) partOpts.variableIds = variableIds;
          const parts = filterCountryProductParts(index.parts ?? [], partOpts);
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
      try {
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
      } catch (err) {
        throw classifyDuckDbError(err);
      }
    },
    async querySql(sql: string) {
      const connection = await ensureConn();
      try {
        const table = await connection.query(sql);
        return table
          .toArray()
          .map((row) => row.toJSON() as Record<string, unknown>);
      } catch (err) {
        throw classifyDuckDbError(err);
      }
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
