/**
 * Apply catalog `transform` to raw columns before cross-section normalisation.
 * `log` → ln(1 + max(0, x)) so trade volumes / distances stay defined at 0.
 */

import { isFiniteNumber } from "./math.js";
import type { CatalogTransformId, VariableSpec } from "./types.js";

export function applyCatalogTransformValue(
  value: number | null,
  transform: CatalogTransformId | undefined,
): number | null {
  if (value == null || !isFiniteNumber(value)) return null;
  if (transform === "log") {
    return Math.log1p(Math.max(0, value));
  }
  return value;
}

/** Row-major matrix → same shape with per-column catalog transforms. */
export function applyCatalogTransforms(
  matrix: readonly (readonly (number | null)[])[],
  variables: readonly VariableSpec[],
): (number | null)[][] {
  return matrix.map((row) =>
    variables.map((v, j) =>
      applyCatalogTransformValue(row[j] ?? null, v.transform ?? "none"),
    ),
  );
}

/**
 * Drop alias variables when both alias and canonical id are selected
 * (LPIN+LPI, CLI+PLI, INAN+INFL, UNRA+UNEMP). Prefer the canonical id.
 */
export function dropCoWeightedAliases(variables: readonly VariableSpec[]): {
  kept: VariableSpec[];
  dropped: string[];
} {
  const ids = new Set(variables.map((v) => v.id));
  const dropped: string[] = [];
  const kept: VariableSpec[] = [];
  for (const v of variables) {
    const canon = v.aliasOf;
    if (canon && ids.has(canon)) {
      dropped.push(v.id);
      continue;
    }
    kept.push(v);
  }
  return { kept, dropped };
}
