import { DemoPanelPendingError } from "./demoPanel";

/** Typed analysis failure for View shells (pending release vs hard error). */
export type AnalysisModelError = {
  kind: "pending" | "error";
  message: string;
};

export function analysisErrorFromUnknown(err: unknown): AnalysisModelError {
  if (err instanceof DemoPanelPendingError) {
    return { kind: "pending", message: err.message };
  }
  if (err instanceof Error && err.name === "DemoPanelPendingError") {
    return { kind: "pending", message: err.message };
  }
  return {
    kind: "error",
    message: err instanceof Error ? err.message : String(err),
  };
}

export function analysisErrorMessage(message: string): AnalysisModelError {
  return { kind: "error", message };
}
