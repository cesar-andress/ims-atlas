import { createContext } from "react";
import type { AtlasProject } from "./projectModel";
import type { AnalysisConfig, ViewId } from "./schema";

export type AnalysisContextValue = {
  config: AnalysisConfig;
  setConfig: (patch: Partial<AnalysisConfig>) => void;
  /** Replace the whole config (presets/import); clears leftover compare/matrix/map fields. */
  replaceConfig: (next: AnalysisConfig) => void;
  setView: (view: ViewId) => void;
  /** Active library project (null = untitled / not opened from library). */
  activeProject: AtlasProject | null;
  dirty: boolean;
  saveProject: (label?: string) => Promise<void>;
  exportProject: () => string;
  importProject: (json: string) => void;
  openProject: (project: AtlasProject) => void;
  clearActiveProject: () => void;
};

export const AnalysisContext = createContext<AnalysisContextValue | null>(null);
