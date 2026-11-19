import { describe, expect, it } from "vitest";
import { dataConfig, releaseUrl } from "./dataConfig";

describe("dataConfig", () => {
  it("exposes a release version and /data base path", () => {
    expect(dataConfig.release_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(dataConfig.release_base_path).toBe("/data");
    expect(releaseUrl("manifest.json")).toBe(
      `/data/v${dataConfig.release_version}/manifest.json`,
    );
  });
});
