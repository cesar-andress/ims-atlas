import { createContext } from "react";
import type { AnalysisConfig, ViewId } from "./schema";

export type AnalysisContextValue = {
  config: AnalysisConfig;
  setConfig: (patch: Partial<AnalysisConfig>) => void;
  /** Replace the whole config (presets/import); clears leftover compare/matrix/map fields. */
  replaceConfig: (next: AnalysisConfig) => void;
  setView: (view: ViewId) => void;
  saveProject: (label?: string) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
};

export const AnalysisContext = createContext<AnalysisContextValue | null>(null);
