import { describe, expect, it } from "vitest";
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

  it("maps ordinary errors", () => {
    expect(analysisErrorFromUnknown(new Error("boom"))).toEqual({
      kind: "error",
      message: "boom",
    });
    expect(analysisErrorMessage("x")).toEqual({ kind: "error", message: "x" });
  });
});
