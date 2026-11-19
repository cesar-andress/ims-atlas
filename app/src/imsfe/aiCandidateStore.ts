/**
 * Phase A4 — AI/secondary candidates stay in the browser only.
 * Never uploaded; ai_candidate never enters rankings until verified.
 */

import type { DataCell, DataCellState, VerificationVerdict } from "@ims-atlas/core";

const KEY = "ims-atlas.ai-candidates.v1";

export type AiCandidateRow = {
  id: string;
  variableId: string;
  iso3: string;
  year: number;
  value: number;
  sourceUrl: string;
  origin: "ai" | "secondary";
  state: DataCellState;
  verifiedBy?: string;
  verifiedOn?: string;
  verdict?: VerificationVerdict;
  officialValue?: number | null;
};

/** In-memory fallback when localStorage is unavailable (tests / SSR). */
let memory: AiCandidateRow[] = [];

function load(): AiCandidateRow[] {
  if (typeof localStorage === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRow);
  } catch {
    return [];
  }
}

function save(rows: AiCandidateRow[]): void {
  memory = rows;
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(rows));
}

function isRow(x: unknown): x is AiCandidateRow {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.variableId === "string" &&
    typeof o.iso3 === "string" &&
    typeof o.year === "number" &&
    typeof o.value === "number" &&
    typeof o.sourceUrl === "string" &&
    (o.origin === "ai" || o.origin === "secondary") &&
    typeof o.state === "string"
  );
}

export function listAiCandidates(): AiCandidateRow[] {
  return load();
}

export function clearAiCandidates(): void {
  memory = [];
  if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
}

export function toDataCells(rows: readonly AiCandidateRow[]): DataCell[] {
  return rows.map((r) => {
    const cell: DataCell = {
      variableId: r.variableId,
      iso3: r.iso3,
      year: r.year,
      value: r.value,
      state: r.state,
      sourceUrl: r.sourceUrl,
      origin: r.origin,
    };
    if (r.verifiedBy !== undefined) cell.verifiedBy = r.verifiedBy;
    if (r.verifiedOn !== undefined) cell.verifiedOn = r.verifiedOn;
    if (r.verdict !== undefined) cell.verdict = r.verdict;
    return cell;
  });
}

export type ParseCandidatesResult =
  | { ok: true; rows: AiCandidateRow[]; warnings: string[] }
  | { ok: false; error: string };

/** CSV: variable_id,iso3,year,value,source_url,origin */
export function parseAiCandidatesCsv(text: string): ParseCandidatesResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { ok: false, error: "empty_csv" };
  const header = lines[0]!
    .toLowerCase()
    .split(",")
    .map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iVar = idx("variable_id");
  const iIso = idx("iso3");
  const iYear = idx("year");
  const iVal = idx("value");
  const iUrl = idx("source_url");
  const iOrig = idx("origin");
  if ([iVar, iIso, iYear, iVal, iUrl, iOrig].some((i) => i < 0)) {
    return { ok: false, error: "bad_header" };
  }
  const rows: AiCandidateRow[] = [];
  const warnings: string[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li]!.split(",").map((c) => c.trim());
    const origin = cols[iOrig]!;
    if (origin !== "ai" && origin !== "secondary") {
      warnings.push(`row ${li + 1}: origin must be ai|secondary`);
      continue;
    }
    const value = Number(cols[iVal]);
    const year = Number(cols[iYear]);
    if (!Number.isFinite(value) || !Number.isFinite(year)) {
      warnings.push(`row ${li + 1}: bad number`);
      continue;
    }
    rows.push({
      id: `${cols[iVar]}-${cols[iIso]}-${year}-${li}`,
      variableId: cols[iVar]!,
      iso3: cols[iIso]!.toUpperCase(),
      year,
      value,
      sourceUrl: cols[iUrl]!,
      origin,
      state: "ai_candidate",
    });
  }
  if (rows.length === 0) return { ok: false, error: "no_rows" };
  return { ok: true, rows, warnings };
}

export function mergeAiCandidates(incoming: AiCandidateRow[]): AiCandidateRow[] {
  const cur = load();
  const byKey = new Map(cur.map((r) => [`${r.variableId}|${r.iso3}|${r.year}`, r]));
  for (const r of incoming) {
    byKey.set(`${r.variableId}|${r.iso3}|${r.year}`, r);
  }
  const next = [...byKey.values()];
  save(next);
  return next;
}

export function verifyCandidate(
  id: string,
  verdict: VerificationVerdict,
  by: string,
): AiCandidateRow[] {
  const cur = load();
  const next = cur.map((r) => {
    if (r.id !== id) return r;
    const state: DataCellState =
      verdict === "correct" || verdict === "decimal_error" ? "verified" : "rejected";
    return {
      ...r,
      state,
      verdict,
      verifiedBy: by.trim() || "??",
      verifiedOn: new Date().toISOString().slice(0, 10),
    };
  });
  save(next);
  return next;
}
