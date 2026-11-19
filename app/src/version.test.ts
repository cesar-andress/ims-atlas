import { describe, expect, it } from "vitest";
import { version } from "@ims-atlas/core";

describe("app", () => {
  it("imports core version", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
