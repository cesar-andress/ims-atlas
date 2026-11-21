import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dataConfig,
  releaseUrl,
  resetPublicReleaseBaseCache,
  resolvePublicReleaseBase,
} from "./dataConfig";

afterEach(() => {
  vi.unstubAllGlobals();
  resetPublicReleaseBaseCache();
});

describe("dataConfig", () => {
  it("exposes a release version and /data base path", () => {
    expect(dataConfig.release_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(dataConfig.release_base_path).toBe("/data");
    expect(releaseUrl("manifest.json")).toBe(
      `/data/v${dataConfig.release_version}/manifest.json`,
    );
  });

  it("keeps config/data.json aligned with app/public/data/CURRENT", () => {
    // this file lives in app/src/ → app/public/data/CURRENT
    const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const spa = readFileSync(join(appRoot, "public/data/CURRENT"), "utf8")
      .trim()
      .replace(/^v/, "");
    expect(dataConfig.release_version).toBe(spa);
  });

  it("resolvePublicReleaseBase skips CURRENT versions whose parquet 404s", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/CURRENT")) {
        return new Response("1.2.0\n", { status: 200 });
      }
      if (url.includes("/v1.2.0/country_year.parquet")) {
        return new Response("<html>404</html>", {
          status: 404,
          headers: { "content-type": "text/html" },
        });
      }
      if (url.includes("/v1.1.0/country_year.parquet")) {
        if (init?.method === "HEAD" || init?.method === "GET") {
          return new Response(null, { status: 200 });
        }
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const base = await resolvePublicReleaseBase();
    expect(base).toBe("/data/v1.1.0");
  });
});
