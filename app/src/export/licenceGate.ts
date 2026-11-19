import type { GateDecision } from "@ims-atlas/core";

export type ExportCellKind = "raw" | "derived" | "byod" | "local";

/**
 * Licence gate for exports (Phase X §6).
 * - ship_raw → raw values and derived scores/ranks
 * - ship_derived → scores/ranks only (no raw values)
 * - byod_only → BYOD values only when present in this browser (caller marks kind)
 * - local_only → never
 */
export function mayExportCell(
  decision: GateDecision | undefined,
  kind: ExportCellKind,
): boolean {
  if (!decision || decision === "local_only") return false;
  if (decision === "ship_raw") return kind === "raw" || kind === "derived";
  if (decision === "ship_derived") return kind === "derived";
  if (decision === "byod_only") return kind === "byod";
  return false;
}

/** Filter table rows: drop raw columns that the licence forbids. */
export function filterExportColumns<T extends Record<string, unknown>>(
  rows: T[],
  columnKinds: Record<string, ExportCellKind>,
  decisions: Record<string, GateDecision | undefined>,
  columnVariable: Record<string, string>,
): T[] {
  return rows.map((row) => {
    const out = { ...row };
    for (const [col, kind] of Object.entries(columnKinds)) {
      const variableId = columnVariable[col] ?? col;
      if (!mayExportCell(decisions[variableId], kind)) {
        delete out[col];
      }
    }
    return out;
  });
}
