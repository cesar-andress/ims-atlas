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
   * Register release tables. Loads country_year; bilateral is optional so the
   * product chapter can download in parallel (see `includeBilateral`).
   */
  loadRelease(opts?: {
    basePath?: string;
    materialiseBilateral?: boolean;
    /** Default true. Set false to load only country_year first. */
    includeBilateral?: boolean;
  }): Promise<void>;
  /**
   * Register trade chapter bytes and create VIEW `trade_hs2_XX`
   * (credentialed fetch — never DuckDB httpfs on hive paths).
   */
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
  /**
   * @deprecated Always `undefined`. Trade is a VFS VIEW after
   * {@link AtlasDataClient.loadTradeChapter}; do not pass https URLs to
   * `read_parquet` (DuckDB rewrites `hs2=` → `hs2-`).
   */
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
 * Stable string from DuckDB / WASM faults.
 * DuckDB often wraps `WebAssembly.Exception` as
 * `Invalid Error: [object WebAssembly.Exception]` with an empty useful message.
 */
function isOpaqueWasmFaultMessage(text: string): boolean {
  const m = text.trim();
  if (!m) return true;
  if (m === "[object WebAssembly.Exception]" || m === "[object Object]") {
    return true;
  }
  // DuckDB: "Invalid Error: [object WebAssembly.Exception]"
  // String(Error): "Error: Invalid Error: [object WebAssembly.Exception]"
  return /Invalid Error:/i.test(m) || /\[object WebAssembly\.Exception\]/i.test(m);
}

export function duckDbErrorText(err: unknown): string {
  if (err instanceof AtlasDataError) return err.message;
  if (err instanceof Error) {
    const m = (err.message ?? "").trim();
    if (!isOpaqueWasmFaultMessage(m)) return m;
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      const nested = duckDbErrorText(cause);
      if (nested) return nested;
    }
    return "";
  }
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const key of ["message", "msg", "str"] as const) {
      const v = o[key];
      if (typeof v === "string" && v.trim() && !isOpaqueWasmFaultMessage(v)) {
        return v.trim();
      }
    }
  }
  const s = String(err ?? "").trim();
  if (s && !isOpaqueWasmFaultMessage(s)) return s;
  return "";
}

/**
 * Map a DuckDB / httpfs failure to a stable {@link AtlasDataError}.
 * Empty result sets are success — do not call this for “no rows”.
 */
export function classifyDuckDbError(err: unknown): AtlasDataError {
  if (err instanceof AtlasDataError) return err;
  const msg = duckDbErrorText(err);
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
    lower.includes("parquet") ||
    lower.includes("head and get") ||
    lower.includes("webassembly")
  ) {
    return new AtlasDataError(
      msg
        ? `Could not read release parquet: ${msg}`
        : "Could not read release parquet (DuckDB HTTP/WASM).",
      "http_io",
      { cause: err },
    );
  }
  // Bare WASM exception with no message → treat as I/O (usual httpfs mangling).
  if (!msg) {
    return new AtlasDataError(
      "Could not read release parquet (DuckDB HTTP/WASM).",
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

/** Same-origin Authelia session cookies for index/HEAD/GET probes. */
const CREDENTIALED: RequestInit = { credentials: "include" };

/**
 * Fetch a parquet over HTTP **with browser cookies**.
 * DuckDB-WASM httpfs does not send Authelia cookies; `read_parquet(https://…)`
 * often receives the login HTML and fails. Register buffers instead.
 */
export async function fetchParquetBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    method: "GET",
    ...CREDENTIALED,
    cache: "force-cache",
    redirect: "follow",
  });
  if (res.status === 401 || res.status === 403) {
    throw new AtlasDataError(
      "Data release requires an authenticated session (HTTP 401/403).",
      "http_auth",
    );
  }
  if (res.status === 404) {
    throw new AtlasDataError(
      `Release parquet missing (HTTP 404): ${url}. Check /data/CURRENT vs data/release/public.`,
      "http_io",
    );
  }
  if (!res.ok) {
    throw new AtlasDataError(
      `Could not fetch parquet (${res.status}): ${url}`,
      "http_io",
    );
  }
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.subarray(0, Math.min(64, bytes.length)),
  );
  if (
    ct.includes("text/html") ||
    /^\s*<!DOCTYPE/i.test(head) ||
    /^\s*<html/i.test(head)
  ) {
    throw new AtlasDataError(
      "Data release returned HTML instead of parquet (login wall).",
      "http_auth",
    );
  }
  // Parquet magic "PAR1" at start (and end); reject obvious non-parquet.
  if (
    bytes.length >= 4 &&
    !(bytes[0] === 0x50 && bytes[1] === 0x41 && bytes[2] === 0x52 && bytes[3] === 0x31)
  ) {
    throw new AtlasDataError(
      `Not a parquet file at ${url} (missing PAR1 magic).`,
      "http_io",
    );
  }
  return bytes;
}

/** In-memory parquet bytes (same URL → no second network hop this session). */
const parquetByteCache = new Map<string, Uint8Array>();

export async function fetchParquetBytesCached(url: string): Promise<Uint8Array> {
  const hit = parquetByteCache.get(url);
  if (hit) return hit;
  const bytes = await fetchParquetBytes(url);
  parquetByteCache.set(url, bytes);
  return bytes;
}

/** Test helper. */
export function clearParquetByteCacheForTests(): void {
  parquetByteCache.clear();
}

async function registerParquetBuffer(
  database: AsyncDuckDB,
  vfsName: string,
  url: string,
): Promise<string> {
  const bytes = await fetchParquetBytesCached(url);
  await database.registerFileBuffer(vfsName, bytes);
  return vfsName;
}

/** Parallel register with a small concurrency cap (browser connection limit). */
export async function registerParquetBuffersParallel(
  database: AsyncDuckDB,
  items: readonly { vfsName: string; url: string }[],
  concurrency = 8,
): Promise<string[]> {
  if (!items.length) return [];
  const out: string[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const idx = next;
      next += 1;
      if (idx >= items.length) return;
      const item = items[idx]!;
      out[idx] = await registerParquetBuffer(database, item.vfsName, item.url);
    }
  }
  const n = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/**
 * Bilateral may be a single parquet or hive parts under bilateral_year/.
 * Returns registered VFS names for ``read_parquet(...)`` (credentialed).
 */
async function resolveBilateralParquetVfs(
  database: AsyncDuckDB,
  base: string,
): Promise<string> {
  // Quiet mono fallback: probe index with HEAD so a missing hive index does
  // not spam the browser console with a failed GET of index.json.
  const indexUrl = `${base}/bilateral_year/index.json`;
  try {
    const head = await fetch(indexUrl, {
      method: "HEAD",
      cache: "no-store",
      ...CREDENTIALED,
    });
    if (head.ok) {
      const indexRes = await fetch(indexUrl, {
        cache: "no-store",
        ...CREDENTIALED,
      });
      if (indexRes.ok) {
        const index = (await indexRes.json()) as { parts?: string[] };
        const parts = index.parts ?? [];
        if (parts.length) {
          const items = parts.map((rel, i) => ({
            vfsName: `atlas_bil_${i}.parquet`,
            url: `${base}/bilateral_year/${rel}`,
          }));
          const names = await registerParquetBuffersParallel(database, items);
          return `[${names.map((n) => `'${escapeSqlString(n)}'`).join(", ")}]`;
        }
      }
    }
  } catch (err) {
    if (err instanceof AtlasDataError) throw err;
    /* fall through to monolithic file */
  }
  const mono = `${base}/bilateral_year.parquet`;
  const vfs = "atlas_bilateral_year.parquet";
  await registerParquetBuffer(database, vfs, mono);
  return `'${escapeSqlString(vfs)}'`;
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
  let countryYearReady = false;
  let bilateralReady = false;
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
      const includeBilateral = opts?.includeBilateral !== false;
      const wantKey = `${base}|mat=${materialiseBilateral ? 1 : 0}|bil=${includeBilateral ? 1 : 0}`;
      // Idempotent: already have what this call asks for on this base.
      if (
        releaseBase === base &&
        countryYearReady &&
        (!includeBilateral || bilateralReady) &&
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
          if (!db) throw new AtlasDataError("DuckDB not initialised", "init");
          const needCountry = releaseBase !== base || !countryYearReady;
          const needBilateral =
            includeBilateral && (releaseBase !== base || !bilateralReady);

          if (needCountry && needBilateral) {
            // Overlap network: country_year (~0.8MB) + bilateral (~2.5MB).
            const cyVfs = "atlas_country_year.parquet";
            const [, bilateralSource] = await Promise.all([
              registerParquetBuffer(db, cyVfs, countryUrl),
              resolveBilateralParquetVfs(db, base),
            ]);
            await connection.query(`
              CREATE OR REPLACE TABLE country_year AS
              SELECT * FROM read_parquet('${escapeSqlString(cyVfs)}');
            `);
            countryYearReady = true;
            if (materialiseBilateral) {
              await connection.query(`
                CREATE OR REPLACE TABLE bilateral_year AS
                SELECT * FROM read_parquet(${bilateralSource});
              `);
              bilateralMaterialised = true;
            } else {
              await connection.query(`
                CREATE OR REPLACE VIEW bilateral_year AS
                SELECT * FROM read_parquet(${bilateralSource});
              `);
              bilateralMaterialised = false;
            }
            bilateralReady = true;
          } else if (needCountry) {
            const cyVfs = "atlas_country_year.parquet";
            await registerParquetBuffer(db, cyVfs, countryUrl);
            await connection.query(`
              CREATE OR REPLACE TABLE country_year AS
              SELECT * FROM read_parquet('${escapeSqlString(cyVfs)}');
            `);
            countryYearReady = true;
          } else if (needBilateral) {
            const bilateralSource = await resolveBilateralParquetVfs(db, base);
            if (materialiseBilateral) {
              await connection.query(`
                CREATE OR REPLACE TABLE bilateral_year AS
                SELECT * FROM read_parquet(${bilateralSource});
              `);
              bilateralMaterialised = true;
            } else {
              await connection.query(`
                CREATE OR REPLACE VIEW bilateral_year AS
                SELECT * FROM read_parquet(${bilateralSource});
              `);
              bilateralMaterialised = false;
            }
            bilateralReady = true;
          }

          if (releaseBase !== base) {
            countryProductKeys.clear();
            tradeUrls.clear();
            if (needCountry) {
              /* base change already cleared product caches */
            }
          }
          releaseBase = base;
          status = "ready";
        } catch (err) {
          const mapped = classifyDuckDbError(err);
          status = "error";
          error = mapped.message;
          releaseBase = null;
          bilateralMaterialised = false;
          countryYearReady = false;
          bilateralReady = false;
          countryProductKeys.clear();
          tradeUrls.clear();
          throw mapped;
        } finally {
          releasePromise = null;
          releasePromiseKey = null;
        }
      })();
      return releasePromise;
    },
    async loadTradeChapter(hs2, opts) {
      const connection = await ensureConn();
      const key = hs2Key(hs2);
      const base = absoluteDataUrl(opts?.basePath ?? releaseUrl());
      const cacheKey = `${base}|${key}`;
      if (tradeUrls.has(cacheKey)) return true;
      const url = `${base}/trade/hs2=${key}/part.parquet`;
      const ok = await parquetExists(url);
      if (!ok) return false;
      if (!db) return false;
      // Never pass https://…/hs2=XX to DuckDB httpfs: it rewrites `=` → `-`
      // (hs2-26) and HEAD/GET fail. Register bytes, then VIEW on VFS name.
      const vfs = `atlas_trade_${key}.parquet`;
      const table = `trade_hs2_${key}`;
      try {
        await registerParquetBuffer(db, vfs, url);
        await connection.query(`
          CREATE OR REPLACE VIEW ${table} AS
          SELECT * FROM read_parquet('${escapeSqlString(vfs)}');
        `);
      } catch (err) {
        if (err instanceof AtlasDataError) throw err;
        throw classifyDuckDbError(err);
      }
      tradeUrls.set(cacheKey, table);
      return true;
    },
    tradeChapterUrl(hs2) {
      // Legacy: used to return an https URL for read_parquet. Always undefined
      // now — callers must query the VIEW created by loadTradeChapter.
      void hs2;
      return undefined;
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
      const base = absoluteDataUrl(opts?.basePath ?? releaseUrl());
      const sliceKey = `${base}|${key}|y=${years?.join("-") ?? "*"}|v=${(variableIds ?? []).slice().sort().join(",") || "*"}`;
      if (countryProductKeys.has(sliceKey)) return true;
      const chapter = `${base}/country_product/hs2=${key}`;
      const table = `country_product_hs2_${key}`;
      try {
        const indexRes = await fetch(`${chapter}/index.json`, CREDENTIALED);
        const indexCt = (indexRes.headers.get("content-type") ?? "").toLowerCase();
        if (indexRes.ok && !indexCt.includes("text/html")) {
          const index = (await indexRes.json()) as { parts?: string[] };
          const partOpts: {
            years?: readonly number[];
            variableIds?: readonly string[];
          } = {};
          if (years?.length) partOpts.years = years;
          if (variableIds?.length) partOpts.variableIds = variableIds;
          const parts = filterCountryProductParts(index.parts ?? [], partOpts);
          if (!parts.length) return false;
          if (!db) return false;
          const items = parts.map((rel, i) => ({
            vfsName: `atlas_cp_${key}_${i}.parquet`,
            url: `${chapter}/${rel}`,
          }));
          const registered = await registerParquetBuffersParallel(db, items, 8);
          const vfsNames = registered.map((n) => `'${escapeSqlString(n)}'`);
          await connection.query(`
            CREATE OR REPLACE VIEW ${table} AS
            SELECT * FROM read_parquet([${vfsNames.join(", ")}]);
          `);
        } else {
          const url = `${chapter}/part.parquet`;
          if (!db) return false;
          if (!(await parquetExists(url))) return false;
          const vfs = `atlas_cp_${key}_mono.parquet`;
          await registerParquetBuffer(db, vfs, url);
          await connection.query(`
            CREATE OR REPLACE VIEW ${table} AS
            SELECT * FROM read_parquet('${escapeSqlString(vfs)}');
          `);
        }
        countryProductKeys.add(sliceKey);
        return true;
      } catch (err) {
        // Auth / hard I/O must surface; missing chapter stays soft-false.
        if (err instanceof AtlasDataError) throw err;
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
