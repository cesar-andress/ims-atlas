import { createContext } from "react";
import type { AtlasProject } from "./projectModel";
import type { AnalysisConfig, ViewId } from "./schema";

export type CommitNavOpts = {
  markDirty?: boolean;
  /** When set, replace the URL hash (with or without #). Empty string clears it. */
  hash?: string;
};

export type AnalysisContextValue = {
  config: AnalysisConfig;
  setConfig: (patch: Partial<AnalysisConfig>, opts?: CommitNavOpts) => void;
  /** Replace the whole config (presets/import); clears leftover compare/matrix/map fields. */
  replaceConfig: (next: AnalysisConfig, opts?: CommitNavOpts) => void;
  setView: (view: ViewId, opts?: CommitNavOpts) => void;
  /** UI language (header ES/EN switch). Does not mark the project as edited. */
  setLang: (lang: "en" | "es") => void;
  /** Active library project (null = untitled / not opened from library). */
  activeProject: AtlasProject | null;
  dirty: boolean;
  saveProject: (label?: string) => Promise<void>;
  exportProject: () => string;
  importProject: (json: string) => void;
  /** Open a library project; `view` defaults to Resultados (analisis). */
  openProject: (project: AtlasProject, view?: ViewId) => void;
  clearActiveProject: () => void;
};

export const AnalysisContext = createContext<AnalysisContextValue | null>(null);
