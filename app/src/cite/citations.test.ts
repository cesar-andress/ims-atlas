import { describe, expect, it } from "vitest";
import { apaCitation, bibtexCitation, risCitation, SOFTWARE_DOI } from "./citations";
import { hashConfig } from "./configHash";

describe("citations", () => {
  it("marks BYOD variables and pending DOI", () => {
    const apa = apaCitation({
      configHash: "abc",
      origin: "COL",
      hs: "64",
      year: 2023,
      permalink: "https://example.test/cite",
      byodVariableIds: ["MYVAR"],
      softwareVersion: "0.1.0",
    });
    expect(apa).toContain("MYVAR");
    expect(apa).toContain(SOFTWARE_DOI);
    expect(
      bibtexCitation({
        configHash: "abc",
        permalink: "https://example.test/cite",
        byodVariableIds: ["MYVAR"],
        softwareVersion: "0.1.0",
      }),
    ).toContain("MYVAR");
    expect(
      risCitation({
        configHash: "abc",
        permalink: "https://example.test/cite",
        byodVariableIds: [],
        softwareVersion: "0.1.0",
      }),
    ).toContain("TY  - COMP");
  });

  it("hashConfig is stable", async () => {
    const a = await hashConfig({ v: 1, view: "cite", origin: "COL" });
    const b = await hashConfig({ origin: "COL", view: "cite", v: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
