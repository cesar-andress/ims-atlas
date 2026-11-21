import { DemoPanelPendingError } from "./demoPanel";

/** Typed analysis failure for View shells (pending release vs hard error). */
export type AnalysisModelError = {
  kind: "pending" | "error";
  message: string;
};

function isOpaqueWasmFaultMessage(text: string): boolean {
  const m = text.trim();
  if (!m) return true;
  if (m === "[object WebAssembly.Exception]" || m === "[object Object]") {
    return true;
  }
  return /Invalid Error:/i.test(m) || /\[object WebAssembly\.Exception\]/i.test(m);
}

function readableUnknownMessage(err: unknown): string {
  if (err instanceof Error) {
    const m = (err.message ?? "").trim();
    if (m && !isOpaqueWasmFaultMessage(m)) return m;
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      const nested = readableUnknownMessage(cause);
      if (nested) return nested;
    }
    return "Could not read release data (DuckDB WASM).";
  }
  const s = String(err ?? "").trim();
  if (s && !isOpaqueWasmFaultMessage(s)) return s;
  return "Could not read release data (DuckDB WASM).";
}

export function analysisErrorFromUnknown(err: unknown): AnalysisModelError {
  if (err instanceof DemoPanelPendingError) {
    return { kind: "pending", message: err.message };
  }
  if (err instanceof Error && err.name === "DemoPanelPendingError") {
    return { kind: "pending", message: err.message };
  }
  // AtlasDataError from duckdbClient (name check avoids importing WASM client).
  if (err instanceof Error && err.name === "AtlasDataError") {
    return { kind: "error", message: err.message };
  }
  return {
    kind: "error",
    message: readableUnknownMessage(err),
  };
}

export function analysisErrorMessage(message: string): AnalysisModelError {
  return { kind: "error", message };
}
