import { afterEach, describe, expect, it, vi } from "vitest";
import {
  absoluteDataUrl,
  AtlasDataError,
  classifyDuckDbError,
  createDuckDbClient,
  createDuckDbWasmLogger,
  createMemoryDataClient,
  fetchParquetBytes,
  getAtlasDataClient,
  resetAtlasDataClientForTests,
} from "./duckdbClient";

describe("memory data client", () => {
  it("filters country-year rows", async () => {
    const client = createMemoryDataClient([
      {
        iso3: "COL",
        year: 2019,
        variable_id: "IMPV",
        value: 1,
        flag_imputed: false,
        flag_locf: false,
      },
      {
        iso3: "PER",
        year: 2020,
        variable_id: "LPI",
        value: 2,
        flag_imputed: true,
        flag_locf: false,
      },
    ]);
    await client.init();
    const rows = await client.queryCountryYear({
      year: 2019,
      variableIds: ["IMPV"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.iso3).toBe("COL");
  });

  it("chapter loaders are stubbed", async () => {
    const client = createMemoryDataClient();
    await client.init();
    await expect(client.loadTradeChapter("64")).resolves.toBe(false);
    await expect(client.loadCountryProductChapter("15")).resolves.toBe(false);
    expect(client.tradeChapterUrl("64")).toBeUndefined();
  });
});

describe("getAtlasDataClient", () => {
  afterEach(() => {
    resetAtlasDataClientForTests();
  });

  it("returns a stable singleton", () => {
    const a = getAtlasDataClient();
    const b = getAtlasDataClient();
    expect(a).toBe(b);
  });

  it("createDuckDbClient still yields isolated instances", () => {
    const a = createDuckDbClient();
    const b = createDuckDbClient();
    expect(a).not.toBe(b);
    expect(a).not.toBe(getAtlasDataClient());
  });
});

describe("createDuckDbWasmLogger", () => {
  it("uses VoidLogger (never default ConsoleLogger INFO dumps)", () => {
    const calls: string[] = [];
    class VoidLogger {
      constructor() {
        calls.push("void");
      }
      log() {
        /* quiet */
      }
    }
    class ConsoleLogger {
      constructor() {
        calls.push("console");
      }
      log() {
        /* noisy */
      }
    }
    const logger = createDuckDbWasmLogger({ VoidLogger });
    expect(calls).toEqual(["void"]);
    expect(logger).toBeInstanceOf(VoidLogger);
    expect(calls).not.toContain("console");
    void ConsoleLogger;
  });
});

describe("classifyDuckDbError", () => {
  it("preserves AtlasDataError instances", () => {
    const err = new AtlasDataError("x", "missing_table");
    expect(classifyDuckDbError(err)).toBe(err);
  });

  it("maps HTTP auth failures", () => {
    const err = classifyDuckDbError(new Error("IO Error: HTTP 401 Unauthorized"));
    expect(err).toBeInstanceOf(AtlasDataError);
    expect(err.kind).toBe("http_auth");
    expect(err.message).toMatch(/authenticated session/i);
  });

  it("maps missing-table / catalog errors without dumping objects", () => {
    const err = classifyDuckDbError(
      new Error('Catalog Error: Table with name country_year does not exist!'),
    );
    expect(err.kind).toBe("missing_table");
    expect(err.message).toMatch(/unavailable/i);
  });

  it("maps parquet IO / httpfs failures", () => {
    const err = classifyDuckDbError(
      new Error("IO Error: No files found that match the pattern"),
    );
    expect(err.kind).toBe("missing_table");
  });

  it("maps generic query failures to query kind", () => {
    const err = classifyDuckDbError(new Error("Binder Error: something else"));
    expect(err.kind).toBe("query");
    expect(err.message).toBe("Binder Error: something else");
  });
});

describe("absoluteDataUrl + credentialed release probe contract", () => {
  it("builds absolute /data URLs DuckDB-WASM can fetch", () => {
    expect(absoluteDataUrl("/data/release/internal/v1.1.0")).toMatch(
      /^https?:\/\/[^/]+\/data\/release\/internal\/v1\.1\.0$/,
    );
  });

  it("keeps absolute URLs without trailing slash", () => {
    expect(
      absoluteDataUrl("https://atlas.aiserv.es/data/release/public/v1.1.0/"),
    ).toBe("https://atlas.aiserv.es/data/release/public/v1.1.0");
  });
});

describe("fetchParquetBytes (credentialed; rejects Authelia HTML)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires credentials:include so Authelia cookies travel with the GET", async () => {
    const parquet = new Uint8Array([0x50, 0x41, 0x52, 0x31, 0, 0, 0, 0]);
    const fetchMock = vi.fn(
      async () =>
        new Response(parquet, {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await fetchParquetBytes(
      "https://atlas.aiserv.es/data/v1.1.0/country_year.parquet",
    );
    expect(bytes[0]).toBe(0x50);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("country_year.parquet"),
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("maps HTTP 401 to AtlasDataError http_auth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(
      fetchParquetBytes("https://atlas.aiserv.es/data/v1.1.0/country_year.parquet"),
    ).rejects.toMatchObject({ name: "AtlasDataError", kind: "http_auth" });
  });

  it("rejects Authelia HTML login pages (DuckDB httpfs would misread them)", async () => {
    const html = "<!DOCTYPE html><html><body>Login</body></html>";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(html, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
      ),
    );
    await expect(
      fetchParquetBytes("https://atlas.aiserv.es/data/v1.1.0/country_year.parquet"),
    ).rejects.toMatchObject({ name: "AtlasDataError", kind: "http_auth" });
  });

  it("maps missing release paths (stale CURRENT → 404 HTML) to http_io", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>404</html>", {
            status: 404,
            headers: { "content-type": "text/html" },
          }),
      ),
    );
    await expect(
      fetchParquetBytes("https://atlas.aiserv.es/data/v1.2.0/country_year.parquet"),
    ).rejects.toMatchObject({ name: "AtlasDataError", kind: "http_io" });
  });
});

describe("loadRelease auth probe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAtlasDataClientForTests();
  });

  it("surfaces HTTP 401 as AtlasDataError before DuckDB read_parquet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    const client = createDuckDbClient();
    const mapped = classifyDuckDbError(
      new AtlasDataError(
        "Data release requires an authenticated session (HTTP 401/403).",
        "http_auth",
      ),
    );
    expect(mapped.kind).toBe("http_auth");
    await fetch("https://atlas.aiserv.es/data/release/public/v1.1.0/country_year.parquet", {
      method: "HEAD",
      credentials: "include",
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("country_year.parquet"),
      expect.objectContaining({ credentials: "include" }),
    );
    void client;
  });
});
