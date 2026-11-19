import {
  AnalysisConfigSchema,
  ProjectFileSchema,
  type AnalysisConfig,
  type ProjectFile,
} from "./schema";

const STORAGE_KEY = "ims-atlas.project.v1";

export function loadProjectFromStorage(): AnalysisConfig | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = ProjectFileSchema.parse(JSON.parse(raw));
    return AnalysisConfigSchema.parse(parsed.config);
  } catch {
    return null;
  }
}

export function saveProjectToStorage(
  config: AnalysisConfig,
  label?: string,
): ProjectFile {
  const file: ProjectFile = {
    kind: "ims-atlas-project",
    savedAt: new Date().toISOString(),
    config: AnalysisConfigSchema.parse(config),
    ...(label !== undefined ? { label } : {}),
  };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  }
  return file;
}

export function exportProjectJson(config: AnalysisConfig, label?: string): string {
  const file = saveProjectToStorage(config, label);
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function importProjectJson(text: string): AnalysisConfig {
  const parsed = ProjectFileSchema.parse(JSON.parse(text));
  const config = AnalysisConfigSchema.parse(parsed.config);
  saveProjectToStorage(config, parsed.label);
  return config;
}

export function clearProjectStorage(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
