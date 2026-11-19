/**
 * BYOD variables: parsed and kept in memory + localStorage only.
 * Never sent on the network (enforced by tests spying on fetch).
 */

import type { Direction, FactorId } from "@ims-atlas/core";

export type ByodRow = {
  iso3: string;
  year: number;
  value: number;
  iso3_d?: string | undefined;
};

export type ByodVariable = {
  id: string;
  label: string;
  direction: Direction;
  factor: FactorId;
  rows: ByodRow[];
  addedAt: string;
};

const STORAGE_KEY = "ims-atlas-byod-v1";

let memory: ByodVariable[] = loadFromStorage();

function loadFromStorage(): ByodVariable[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ByodVariable[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

export function listByodVariables(): ByodVariable[] {
  return [...memory];
}

export function clearByodVariables(): void {
  memory = [];
  persist();
}

export function removeByodVariable(id: string): void {
  memory = memory.filter((v) => v.id !== id);
  persist();
}

const ISO3 = /^[A-Za-z]{3}$/;

export type ParseCsvResult =
  { ok: true; rows: ByodRow[]; warnings: string[] } | { ok: false; error: string };

/** Parse CSV text: header must include iso3, year, value; optional iso3_d. */
export function parseByodCsv(text: string): ParseCsvResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2)
    return { ok: false, error: "CSV needs a header and at least one row" };
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const iIso = header.indexOf("iso3");
  const iYear = header.indexOf("year");
  const iVal = header.indexOf("value");
  const iDest = header.indexOf("iso3_d");
  if (iIso < 0 || iYear < 0 || iVal < 0) {
    return { ok: false, error: "Header must include iso3, year, value" };
  }
  const rows: ByodRow[] = [];
  const warnings: string[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li]!.split(",").map((c) => c.trim());
    const iso = (cols[iIso] ?? "").toUpperCase();
    const year = Number(cols[iYear]);
    const value = Number(cols[iVal]);
    if (!ISO3.test(iso)) {
      warnings.push(`row ${li + 1}: bad iso3`);
      continue;
    }
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      warnings.push(`row ${li + 1}: bad year`);
      continue;
    }
    if (!Number.isFinite(value)) {
      warnings.push(`row ${li + 1}: bad value`);
      continue;
    }
    const row: ByodRow = { iso3: iso, year, value };
    if (iDest >= 0 && cols[iDest]) {
      const d = cols[iDest]!.toUpperCase();
      if (!ISO3.test(d)) {
        warnings.push(`row ${li + 1}: bad iso3_d`);
        continue;
      }
      row.iso3_d = d;
    }
    rows.push(row);
  }
  if (rows.length === 0) return { ok: false, error: "No valid data rows" };
  return { ok: true, rows, warnings };
}

export function addByodVariable(input: {
  id: string;
  label: string;
  direction: Direction;
  factor: FactorId;
  rows: ByodRow[];
}): ByodVariable {
  const id = input.id
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  if (!id || id.length > 32) throw new Error("Invalid variable id");
  if (memory.some((v) => v.id === id)) throw new Error(`Variable ${id} already exists`);
  const variable: ByodVariable = {
    id,
    label: input.label.trim() || id,
    direction: input.direction,
    factor: input.factor,
    rows: input.rows,
    addedAt: new Date().toISOString(),
  };
  memory = [...memory, variable];
  persist();
  return variable;
}

/** Values for a destination set at a given year (country-level BYOD). */
export function byodValuesForYear(
  variableId: string,
  year: number,
  candidates: readonly string[],
): (number | null)[] {
  const v = memory.find((x) => x.id === variableId);
  if (!v) return candidates.map(() => null);
  const map = new Map<string, number>();
  for (const row of v.rows) {
    if (row.year !== year) continue;
    // Bilateral rows use iso3_d as destination; country rows use iso3.
    const key = row.iso3_d ?? row.iso3;
    map.set(key, row.value);
  }
  return candidates.map((iso) => (map.has(iso) ? map.get(iso)! : null));
}
