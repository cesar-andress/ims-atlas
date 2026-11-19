import { describe, expect, it } from "vitest";
import { nextCompareSelection } from "./compareSelection";

describe("nextCompareSelection", () => {
  it("sets A on first pick", () => {
    expect(nextCompareSelection(undefined, undefined, "USA")).toEqual({
      compareA: "USA",
    });
  });

  it("sets B on second distinct pick", () => {
    expect(nextCompareSelection("USA", undefined, "CHN")).toEqual({
      compareB: "CHN",
    });
  });

  it("resets to A on third pick", () => {
    expect(nextCompareSelection("USA", "CHN", "DEU")).toEqual({
      compareA: "DEU",
      compareB: undefined,
    });
  });

  it("re-clicking A only reasserts A (B cleared by explicit undefined only on reset)", () => {
    expect(nextCompareSelection("USA", "CHN", "USA")).toEqual({
      compareA: "USA",
    });
  });
});
