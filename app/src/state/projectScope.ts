/**
 * Project scope (origin · product · year): completeness helpers and a
 * lightweight open-dialog signal so Results / Variables can request the bar modal.
 */

export type ScopeField = "origin" | "hs" | "year";

export type ScopeSnapshot = {
  origin?: string | undefined;
  hs?: string | undefined;
  year?: number | undefined;
};

export const OPEN_SCOPE_EVENT = "ims-atlas:open-scope";

/** Ask ProjectBar to open the origin / product / year dialog. */
export function requestOpenScope(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SCOPE_EVENT));
}

export function parseYearDraft(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1900 || n > 2100) return undefined;
  return n;
}

export function normalizeHsDraft(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length < 2) return undefined;
  return digits;
}

/** Fields still missing for ranking / panel load. */
export function missingScopeFields(scope: ScopeSnapshot): ScopeField[] {
  const missing: ScopeField[] = [];
  if (!scope.origin || !/^[A-Z]{3}$/.test(scope.origin)) missing.push("origin");
  if (!scope.hs || scope.hs.length < 2) missing.push("hs");
  if (scope.year === undefined || !Number.isInteger(scope.year)) missing.push("year");
  return missing;
}

export function isScopeComplete(scope: ScopeSnapshot): boolean {
  return missingScopeFields(scope).length === 0;
}

/** Equal factor shares for a free panel_all selection (sum = 1). */
export function equalFactorWeights(factorIds: string[]): Record<string, number> {
  if (factorIds.length === 0) return {};
  const share = 1 / factorIds.length;
  return Object.fromEntries(factorIds.map((id) => [id, share]));
}
