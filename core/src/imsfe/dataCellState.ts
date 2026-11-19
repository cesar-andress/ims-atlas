/**
 * Phase A4 — per-cell data states. Only official / manual / verified enter rankings.
 */

export type DataCellState =
  "official" | "manual" | "ai_candidate" | "verified" | "rejected";

export const COMPUTABLE_STATES: ReadonlySet<DataCellState> = new Set([
  "official",
  "manual",
  "verified",
]);

export function isComputableState(state: DataCellState): boolean {
  return COMPUTABLE_STATES.has(state);
}

export type DataCell = {
  variableId: string;
  iso3: string;
  year: number;
  value: number;
  state: DataCellState;
  sourceUrl?: string;
  origin?: "ai" | "secondary" | "official" | "manual";
  verifiedBy?: string;
  verifiedOn?: string;
  verdict?: VerificationVerdict;
};

export type VerificationVerdict =
  "correct" | "decimal_error" | "different_value" | "no_source";

/** Gate: drop non-computable cells (ai_candidate / rejected never score). */
export function filterComputableCells(cells: readonly DataCell[]): DataCell[] {
  return cells.filter((c) => isComputableState(c.state) && Number.isFinite(c.value));
}

/**
 * Build a variable×iso score map for scoring; only computable states.
 * Duplicate keys: last computable wins (deterministic if input order fixed).
 */
export function cellsToScoreMap(
  cells: readonly DataCell[],
  variableId: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of filterComputableCells(cells)) {
    if (c.variableId !== variableId) continue;
    out[c.iso3] = c.value;
  }
  return out;
}

export function assertNoAiInScores(
  cells: readonly DataCell[],
  scores: Record<string, number>,
): void {
  for (const c of cells) {
    if (c.state === "ai_candidate" || c.state === "rejected") {
      if (c.iso3 in scores && scores[c.iso3] === c.value) {
        // Only fail if the score equals the excluded candidate and no other
        // computable cell provided that value — soft check: excluded states
        // must not be the sole source.
        const others = cells.filter(
          (x) =>
            x.iso3 === c.iso3 &&
            x.variableId === c.variableId &&
            isComputableState(x.state),
        );
        if (others.length === 0) {
          throw new Error(
            `ai_candidate/rejected value for ${c.variableId}/${c.iso3} entered scores`,
          );
        }
      }
    }
  }
}
