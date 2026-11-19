import { describe, expect, it } from "vitest";
import { taint } from "./access.js";

describe("taint", () => {
  it("keeps abierta when all inputs are abierta", () => {
    expect(taint("abierta", "abierta")).toBe("abierta");
  });

  it("returns cerrada when any input is cerrada", () => {
    expect(taint("abierta", "cerrada")).toBe("cerrada");
  });

  it("ignores nullish", () => {
    expect(taint("abierta", null, undefined)).toBe("abierta");
  });
});
