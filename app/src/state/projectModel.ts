/**
 * Phase G project model (versioned). Import boundary validates with parseAtlasProject.
 * Legacy `ims-atlas-project` (v1 ProjectFile) migrates to schemaVersion 2.
 */

import { countryLabel } from "../design/formatLocale";
import { hsLabel } from "../data/hsProducts";
import { parseAnalysisConfig, type AnalysisConfig, type ProjectFile } from "./schema";

export type MissingFillPolicy = "drop" | "locf" | "median" | "keep";

export type ByodDefinition = {
  id: string;
  label: string;
  direction: "benefit" | "cost";
  factor: string;
};

export type AtlasProject = {
  schemaVersion: 2;
  kind: "ims-atlas-project";
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** Analysis permalink payload (view may be overridden when opening). */
  config: AnalysisConfig;
  yearFrom?: number;
  yearTo?: number;
  candidateIsos?: string[];
  notes?: string;
  dataReleaseId?: string;
  byodDefinitions?: ByodDefinition[];
  /** Never true unless the user ticks "include my data" on export. */
  includeByodValues?: boolean;
  missingPolicyByVar?: Record<string, MissingFillPolicy>;
  /** True for the worked example created on first visit (shown as "Ejemplo"). */
  isExample?: boolean;
};

export type ProjectListItem = {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  origin?: string;
  hs?: string;
  yearFrom?: number;
  yearTo?: number;
  isExample?: boolean;
  /** Present when the row comes from the shared team library. */
  createdBy?: string;
  updatedBy?: string;
  source?: "team" | "local";
  /** Visible team autoincrement id (SQLite display_id). */
  displayId?: number;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyProject(
  partial?: Partial<AtlasProject> & { config?: AnalysisConfig },
): AtlasProject {
  const now = new Date().toISOString();
  const config = partial?.config ?? { v: 1 as const, view: "variables" as const };
  return {
    schemaVersion: 2,
    kind: "ims-atlas-project",
    id: partial?.id ?? newId(),
    name: partial?.name ?? "Proyecto nuevo",
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
    config: parseAnalysisConfig(config),
    ...(partial?.description !== undefined ? { description: partial.description } : {}),
    ...(partial?.yearFrom !== undefined ? { yearFrom: partial.yearFrom } : {}),
    ...(partial?.yearTo !== undefined ? { yearTo: partial.yearTo } : {}),
    ...(partial?.candidateIsos !== undefined
      ? { candidateIsos: partial.candidateIsos }
      : {}),
    ...(partial?.notes !== undefined ? { notes: partial.notes } : {}),
    ...(partial?.dataReleaseId !== undefined
      ? { dataReleaseId: partial.dataReleaseId }
      : {}),
    ...(partial?.byodDefinitions !== undefined
      ? { byodDefinitions: partial.byodDefinitions }
      : {}),
    ...(partial?.includeByodValues !== undefined
      ? { includeByodValues: partial.includeByodValues }
      : {}),
    ...(partial?.missingPolicyByVar !== undefined
      ? { missingPolicyByVar: partial.missingPolicyByVar }
      : {}),
    ...(partial?.isExample === true ? { isExample: true } : {}),
  };
}

/** Migrate legacy single-slot ProjectFile / loose JSON → AtlasProject v2. */
export function migrateToAtlasProject(raw: unknown): AtlasProject {
  if (!isObject(raw)) throw new Error("Project must be a JSON object.");

  // Already v2
  if (raw.schemaVersion === 2 && raw.kind === "ims-atlas-project") {
    return parseAtlasProject(raw);
  }

  // Legacy ProjectFile (no schemaVersion)
  if (raw.kind === "ims-atlas-project" && raw.config !== undefined) {
    const legacy = raw as Partial<ProjectFile> & { config: unknown };
    const config = parseAnalysisConfig(legacy.config);
    const label =
      typeof legacy.label === "string" && legacy.label.trim()
        ? legacy.label.trim()
        : defaultNameFromConfig(config);
    const savedAt =
      typeof legacy.savedAt === "string" ? legacy.savedAt : new Date().toISOString();
    const partial: Partial<AtlasProject> & { config: AnalysisConfig } = {
      name: label,
      createdAt: savedAt,
      updatedAt: savedAt,
      config,
    };
    if (config.year !== undefined) {
      partial.yearFrom = config.year;
      partial.yearTo = config.year;
    }
    return createEmptyProject(partial);
  }

  throw new Error(
    'Unrecognised project file. Expected kind "ims-atlas-project" (Atlas export).',
  );
}

export function parseAtlasProject(raw: unknown): AtlasProject {
  if (!isObject(raw)) throw new Error("Project must be a JSON object.");
  if (raw.kind !== "ims-atlas-project") {
    throw new Error('Invalid kind (expected "ims-atlas-project").');
  }
  if (raw.schemaVersion !== 2) {
    return migrateToAtlasProject(raw);
  }
  if (typeof raw.id !== "string" || !raw.id.trim()) {
    throw new Error("Project id is required.");
  }
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    throw new Error("Project name is required.");
  }
  if (typeof raw.createdAt !== "string" || typeof raw.updatedAt !== "string") {
    throw new Error("createdAt and updatedAt are required ISO timestamps.");
  }
  const config = parseAnalysisConfig(raw.config);
  const out: AtlasProject = {
    schemaVersion: 2,
    kind: "ims-atlas-project",
    id: raw.id.trim(),
    name: raw.name.trim().slice(0, 160),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    config,
  };
  if (typeof raw.description === "string") {
    out.description = raw.description.slice(0, 2000);
  }
  if (typeof raw.yearFrom === "number" && Number.isFinite(raw.yearFrom)) {
    out.yearFrom = Math.trunc(raw.yearFrom);
  }
  if (typeof raw.yearTo === "number" && Number.isFinite(raw.yearTo)) {
    out.yearTo = Math.trunc(raw.yearTo);
  }
  if (Array.isArray(raw.candidateIsos)) {
    out.candidateIsos = raw.candidateIsos
      .filter((x): x is string => typeof x === "string" && /^[A-Za-z]{3}$/.test(x))
      .map((x) => x.toUpperCase())
      .slice(0, 250);
  }
  if (typeof raw.notes === "string") out.notes = raw.notes.slice(0, 8000);
  if (typeof raw.dataReleaseId === "string") {
    out.dataReleaseId = raw.dataReleaseId.slice(0, 64);
  }
  if (Array.isArray(raw.byodDefinitions)) {
    out.byodDefinitions = raw.byodDefinitions
      .filter(isObject)
      .map((d) => ({
        id: String(d.id ?? "").slice(0, 32),
        label: String(d.label ?? d.id ?? "").slice(0, 80),
        direction: d.direction === "cost" ? ("cost" as const) : ("benefit" as const),
        factor: String(d.factor ?? "byod").slice(0, 32),
      }))
      .filter((d) => d.id.length > 0)
      .slice(0, 32);
  }
  if (typeof raw.includeByodValues === "boolean") {
    out.includeByodValues = raw.includeByodValues;
  }
  if (raw.isExample === true) out.isExample = true;
  if (isObject(raw.missingPolicyByVar)) {
    const pol: Record<string, MissingFillPolicy> = {};
    for (const [k, v] of Object.entries(raw.missingPolicyByVar)) {
      if (v === "drop" || v === "locf" || v === "median" || v === "keep") {
        pol[k] = v;
      }
    }
    if (Object.keys(pol).length) out.missingPolicyByVar = pol;
  }
  return out;
}

export function defaultNameFromConfig(config: AnalysisConfig): string {
  if (!config.hs && !config.origin && config.year === undefined) {
    return "Proyecto nuevo";
  }
  const product = config.hs ? hsLabel(config.hs, "es") : null;
  // Shorten long HS labels: take first clause before comma / parenthesis.
  const shortProduct = product
    ? product.split(/[,;(]/)[0]!.trim().slice(0, 40) || product
    : null;
  const origin = config.origin ? countryLabel(config.origin, "es") : null;
  const y0 = config.year;
  const parts = [shortProduct, origin, y0 !== undefined ? String(y0) : null].filter(
    (p): p is string => Boolean(p && p !== "???"),
  );
  // Plain scope label (Prompt 4e / B2): never «Project», «???» or «Untitled».
  return parts.length > 0 ? parts.join(" · ") : "Proyecto nuevo";
}

export function toListItem(p: AtlasProject): ProjectListItem {
  return {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    ...(p.config.origin ? { origin: p.config.origin } : {}),
    ...(p.config.hs ? { hs: p.config.hs } : {}),
    ...(p.yearFrom !== undefined ? { yearFrom: p.yearFrom } : {}),
    ...(p.yearTo !== undefined ? { yearTo: p.yearTo } : {}),
    ...(p.isExample === true ? { isExample: true } : {}),
  };
}

export function touchProject(
  project: AtlasProject,
  patch: Partial<AtlasProject>,
): AtlasProject {
  return {
    ...project,
    ...patch,
    schemaVersion: 2,
    kind: "ims-atlas-project",
    id: project.id,
    updatedAt: new Date().toISOString(),
    config: patch.config ? parseAnalysisConfig(patch.config) : project.config,
  };
}

/** Serialize for download (.atlas.json). Strips BYOD values unless includeByodValues. */
export function serializeAtlasProject(project: AtlasProject): string {
  const payload: AtlasProject = { ...project };
  if (!payload.includeByodValues) {
    // Definitions only — values live in byodStore and are never embedded here.
    payload.includeByodValues = false;
  }
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function plainErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Could not read this project file.";
}
