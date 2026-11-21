import { describe, expect, it } from "vitest";
import { absoluteDataUrl } from "./duckdbClient";

describe("absoluteDataUrl", () => {
  it("turns a site path into an absolute URL DuckDB-WASM can fetch", () => {
    const out = absoluteDataUrl("/data/v1.1.0");
    expect(out).toMatch(/^https?:\/\/[^/]+\/data\/v1\.1\.0$/);
  });

  it("keeps absolute URLs and drops a trailing slash", () => {
    expect(absoluteDataUrl("https://atlas.aiserv.es/data/release/internal/v1.1.0/")).toBe(
      "https://atlas.aiserv.es/data/release/internal/v1.1.0",
    );
  });
});
