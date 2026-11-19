import { describe, expect, it } from "vitest";
import {
  configToSearch,
  decodeConfig,
  encodeConfig,
  parseConfigFromSearch,
  viewFromPath,
} from "./urlState";
import type { AnalysisConfig } from "./schema";

describe("urlState", () => {
  it("round-trips a compact config", () => {
    const config: AnalysisConfig = {
      v: 1,
      view: "catalog",
      origin: "COL",
      year: 2019,
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "equal",
      missingThreshold: 0.2,
      variableIds: ["IMPV", "LPI"],
      lang: "es",
    };
    const encoded = encodeConfig(config);
    expect(decodeConfig(encoded)).toEqual(config);
    const again = parseConfigFromSearch(configToSearch(config));
    expect(again.view).toBe("catalog");
    expect(again.origin).toBe("COL");
    expect(again.variableIds).toEqual(["IMPV", "LPI"]);
  });

  it("falls back on corrupt payload", () => {
    expect(parseConfigFromSearch("?c=!!!").view).toBe("home");
  });

  it("maps paths to views", () => {
    expect(viewFromPath("/")).toBe("home");
    expect(viewFromPath("/catalog")).toBe("catalog");
    expect(viewFromPath("/nope")).toBe("home");
  });
});
