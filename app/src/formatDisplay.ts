/** Display helper for sparse JSON / table cells. */
export function displayCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}
