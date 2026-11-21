/**
 * Team library names are unique (case-insensitive) among active projects.
 * Default UI labels like «Proyecto nuevo» collide constantly; prefer a
 * scope-derived name and disambiguate on name_conflict.
 */

import { defaultNameFromConfig, type AtlasProject } from "./projectModel";

const GENERIC_NAMES = new Set([
  "proyecto nuevo",
  "new project",
  "proyecto sin nombre",
  "untitled project",
  "untitled",
]);

export function isGenericProjectName(name: string): boolean {
  const key = name.trim().toLowerCase();
  return key.length === 0 || GENERIC_NAMES.has(key);
}

/** Prefer a scope label when the UI still shows a generic default title. */
export function preferredSaveName(project: AtlasProject): string {
  const current = project.name.trim().slice(0, 160);
  if (!isGenericProjectName(current)) return current || "Untitled project";
  const cfg = project.config;
  if (cfg.origin || cfg.hs || cfg.year !== undefined) {
    return defaultNameFromConfig(cfg).slice(0, 160);
  }
  return current || "Untitled project";
}

/**
 * Append `` (n)`` for n >= 2. Strips a trailing `` (digits)`` first so retries
 * do not stack suffixes.
 */
export function withNameDisambiguation(name: string, n: number): string {
  const trimmed = name.trim() || "Untitled project";
  if (n <= 1) return trimmed.slice(0, 160);
  const base = trimmed.replace(/\s*\(\d+\)\s*$/u, "").trim() || "Untitled project";
  const suffix = ` (${n})`;
  const maxBase = Math.max(1, 160 - suffix.length);
  return `${base.slice(0, maxBase)}${suffix}`;
}

export function isNameConflictError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const e = err as { status?: unknown; code?: unknown; message?: unknown };
  if (e.code === "name_conflict") return true;
  if (e.status === 409 && typeof e.message === "string") {
    return /already exists/i.test(e.message);
  }
  return false;
}
