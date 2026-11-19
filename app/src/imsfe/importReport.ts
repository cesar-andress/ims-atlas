/**
 * Phase A1 — anonymised IMSFE workbook import report (from atlas-etl imsfe-import).
 * Never contains respondent personal names.
 */

export type ImsfeImportReport = {
  path_label: string;
  origin: string | null;
  hs_code: string | null;
  scale: number | null;
  n_criteria: number;
  n_variables: number;
  n_experts: number;
  expert_labels: string[];
  criterion_weights: Record<string, number>;
  variable_weights: Record<string, number>;
  variable_direction: Record<string, string>;
  final_scores: Record<string, number>;
  preselected_countries: string[];
  assumptions: string[];
  warnings: string[];
};

const FORBIDDEN = [
  "bonilla",
  "barahona",
  "baena",
  "cano arenas",
  "professor",
  "@",
] as const;

export type ParseImportResult =
  { ok: true; report: ImsfeImportReport } | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStringRecord(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

function asNumberRecord(v: unknown): Record<string, number> {
  if (!isRecord(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
  }
  return out;
}

export function parseImsfeImportReportJson(text: string): ParseImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  if (!isRecord(raw)) return { ok: false, error: "not_object" };

  const expert_labels = Array.isArray(raw.expert_labels)
    ? raw.expert_labels.filter((x): x is string => typeof x === "string")
    : [];
  for (const label of expert_labels) {
    if (!/^Expert \d+$/.test(label)) {
      return { ok: false, error: "non_anonymous_expert" };
    }
  }

  const blob = JSON.stringify(raw).toLowerCase();
  for (const token of FORBIDDEN) {
    if (blob.includes(token)) {
      return { ok: false, error: "personal_token" };
    }
  }

  const report: ImsfeImportReport = {
    path_label: typeof raw.path_label === "string" ? raw.path_label : "IMSFE workbook",
    origin: typeof raw.origin === "string" ? raw.origin : null,
    hs_code: typeof raw.hs_code === "string" ? raw.hs_code : null,
    scale: typeof raw.scale === "number" ? raw.scale : null,
    n_criteria: typeof raw.n_criteria === "number" ? raw.n_criteria : 0,
    n_variables: typeof raw.n_variables === "number" ? raw.n_variables : 0,
    n_experts: typeof raw.n_experts === "number" ? raw.n_experts : expert_labels.length,
    expert_labels,
    criterion_weights: asNumberRecord(raw.criterion_weights),
    variable_weights: asNumberRecord(raw.variable_weights),
    variable_direction: asStringRecord(raw.variable_direction),
    final_scores: asNumberRecord(raw.final_scores),
    preselected_countries: Array.isArray(raw.preselected_countries)
      ? raw.preselected_countries.filter((x): x is string => typeof x === "string")
      : Object.keys(asNumberRecord(raw.final_scores)),
    assumptions: Array.isArray(raw.assumptions)
      ? raw.assumptions.filter((x): x is string => typeof x === "string")
      : [],
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((x): x is string => typeof x === "string")
      : [],
  };

  if (Object.keys(report.final_scores).length === 0) {
    return { ok: false, error: "no_scores" };
  }
  return { ok: true, report };
}

/** Ranked list for display (stable: score desc, name asc). */
export function rankedScores(
  scores: Record<string, number>,
): { country: string; score: number; rank: number }[] {
  const rows = Object.entries(scores)
    .map(([country, score]) => ({ country, score }))
    .sort((a, b) => b.score - a.score || a.country.localeCompare(b.country));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function exportImportReportJson(report: ImsfeImportReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
