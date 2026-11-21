/**
 * Compatibility layer + helpers around the Phase G project library.
 * Legacy single-slot localStorage APIs remain for older tests/callers.
 */

import {
  createEmptyProject,
  migrateToAtlasProject,
  parseAtlasProject,
  plainErrorMessage,
  serializeAtlasProject,
  type AtlasProject,
} from "./projectModel";
import { saveDraft } from "./projectIdb";
import { getProject, listProjects, upsertProject } from "./projectLibrary";
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

/** Serialize a project file without touching storage (legacy shape). */
export function exportProjectJson(config: AnalysisConfig, label?: string): string {
  const file: ProjectFile = {
    kind: "ims-atlas-project",
    savedAt: new Date().toISOString(),
    config: AnalysisConfigSchema.parse(config),
    ...(label !== undefined ? { label } : {}),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function exportAtlasJson(project: AtlasProject): string {
  return serializeAtlasProject(project);
}

export function importProjectJson(text: string): AnalysisConfig {
  const raw = JSON.parse(text) as unknown;
  try {
    const project = migrateToAtlasProject(raw);
    void upsertProject(project);
    saveProjectToStorage(project.config, project.name);
    return project.config;
  } catch {
    const parsed = ProjectFileSchema.parse(raw);
    const config = AnalysisConfigSchema.parse(parsed.config);
    saveProjectToStorage(config, parsed.label);
    return config;
  }
}

export function importAtlasProjectJson(text: string): AtlasProject {
  const project = migrateToAtlasProject(JSON.parse(text));
  return project;
}

export function clearProjectStorage(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export async function persistActiveProject(
  project: AtlasProject,
): Promise<import("./projectLibrary").UpsertResult> {
  const saved = await upsertProject({
    ...project,
    updatedAt: new Date().toISOString(),
  });
  saveProjectToStorage(saved.config, saved.name);
  saveDraft(saved);
  return saved;
}

export function projectFromConfig(
  config: AnalysisConfig,
  name?: string,
  existing?: AtlasProject | null,
): AtlasProject {
  if (existing) {
    const next: AtlasProject = {
      ...existing,
      name: name?.trim() || existing.name,
      config: AnalysisConfigSchema.parse(config),
      updatedAt: new Date().toISOString(),
    };
    const yFrom = existing.yearFrom ?? config.year;
    const yTo = existing.yearTo ?? config.year;
    if (yFrom !== undefined) next.yearFrom = yFrom;
    if (yTo !== undefined) next.yearTo = yTo;
    return next;
  }
  const partial: Partial<AtlasProject> & { config: AnalysisConfig } = { config };
  const trimmed = name?.trim();
  if (trimmed) partial.name = trimmed;
  if (config.year !== undefined) {
    partial.yearFrom = config.year;
    partial.yearTo = config.year;
  }
  return createEmptyProject(partial);
}

export {
  listProjects,
  getProject,
  parseAtlasProject,
  plainErrorMessage,
  createEmptyProject,
};
