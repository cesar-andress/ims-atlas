import { describe, expect, it } from "vitest";
import { AtlasDataError } from "../data/duckdbClient";
import { analysisErrorFromUnknown, analysisErrorMessage } from "./analysisError";
import { DemoPanelPendingError } from "./demoPanel";

describe("analysisError", () => {
  it("maps DemoPanelPendingError to pending", () => {
    const err = analysisErrorFromUnknown(
      new DemoPanelPendingError("no redistributable panel"),
    );
    expect(err).toEqual({
      kind: "pending",
      message: "no redistributable panel",
    });
  });

  it("maps name-based pending errors after serialization", () => {
    const raw = new Error("stub");
    raw.name = "DemoPanelPendingError";
    expect(analysisErrorFromUnknown(raw).kind).toBe("pending");
  });

  it("maps AtlasDataError to user-visible analysis error (not pending)", () => {
    expect(
      analysisErrorFromUnknown(
        new AtlasDataError("country_year missing", "missing_table"),
      ),
    ).toEqual({
      kind: "error",
      message: "country_year missing",
    });
  });

  it("maps ordinary errors", () => {
    expect(analysisErrorFromUnknown(new Error("boom"))).toEqual({
      kind: "error",
      message: "boom",
    });
    expect(analysisErrorMessage("x")).toEqual({ kind: "error", message: "x" });
  });

  it("does not surface Invalid Error WebAssembly.Exception as the toast text", () => {
    const err = analysisErrorFromUnknown(
      new Error("Invalid Error: [object WebAssembly.Exception]"),
    );
    expect(err.kind).toBe("error");
    expect(err.message).not.toMatch(/Invalid Error/i);
    expect(err.message).not.toMatch(/\[object WebAssembly/i);
    expect(err.message).toMatch(/DuckDB WASM/i);
  });
});
