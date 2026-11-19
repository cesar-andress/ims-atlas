import { describe, expect, it } from "vitest";
import { makeSyntheticNodes } from "./marketMapPaint";

describe("makeSyntheticNodes", () => {
  it("is deterministic for a seed", () => {
    const a = makeSyntheticNodes(200, 7);
    const b = makeSyntheticNodes(200, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(200);
    expect(new Set(a.map((n) => n.iso3)).size).toBe(200);
  });
});
