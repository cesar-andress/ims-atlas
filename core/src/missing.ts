/**
 * Fixed candidate-set preparation (ports ``imsfe.block_prep``, SPEC §5).
 */

import { isFiniteNumber, median } from "./math.js";
import type { MissingDataPolicy, PreparedBlock } from "./types.js";

export class InsufficientCandidatesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientCandidatesError";
  }
}

export const DEFAULT_MISSING_POLICY: MissingDataPolicy = {
  maxMissingShare: 0.2,
  minCandidates: 20,
  impute: "median",
};

export type PrepareBlockInput = {
  /** Destination ISO3 codes (one per row). */
  candidates: string[];
  /** Column ids aligned with each row's values. */
  columns: string[];
  /** Row-major raw values; null/NaN = missing. */
  values: (number | null)[][];
  policy?: Partial<MissingDataPolicy>;
};

/**
 * Never drop destinations. Exclude variables above missing threshold;
 * median-impute the rest; refuse if n_candidates < minCandidates.
 */
export function prepareBlock(input: PrepareBlockInput): PreparedBlock {
  const policy: MissingDataPolicy = {
    ...DEFAULT_MISSING_POLICY,
    ...input.policy,
  };
  const { candidates, columns, values } = input;
  if (candidates.length !== values.length) {
    throw new Error("candidates length must match values rows");
  }
  const nCand = candidates.length;
  if (nCand < policy.minCandidates) {
    throw new InsufficientCandidatesError(
      `n_candidates=${nCand} < min_candidates=${policy.minCandidates}`,
    );
  }

  const excluded: string[] = [];
  const used: string[] = [];
  const notes: string[] = [];

  for (let j = 0; j < columns.length; j++) {
    const col = columns[j]!;
    let miss = 0;
    let any = false;
    for (let i = 0; i < nCand; i++) {
      const v = values[i]![j];
      if (!isFiniteNumber(v)) miss++;
      else any = true;
    }
    const share = nCand === 0 ? 1 : miss / nCand;
    if (share > policy.maxMissingShare) {
      excluded.push(col);
      notes.push(
        `exclude ${col}: missing_share=${share.toFixed(3)} > ${policy.maxMissingShare}`,
      );
    } else if (!any) {
      excluded.push(col);
      notes.push(`exclude ${col}: all missing`);
    } else {
      used.push(col);
    }
  }

  if (used.length === 0) {
    throw new Error(
      `No usable variables after missing-share filter (excluded=${excluded.join(",")})`,
    );
  }

  if (policy.impute === "none") {
    const stillUsed: string[] = [];
    for (const col of used) {
      const j = columns.indexOf(col);
      let gap = false;
      for (let i = 0; i < nCand; i++) {
        if (!isFiniteNumber(values[i]![j])) {
          gap = true;
          break;
        }
      }
      if (gap) {
        excluded.push(col);
        notes.push(`exclude ${col}: residual gaps with impute=none`);
      } else {
        stillUsed.push(col);
      }
    }
    used.length = 0;
    used.push(...stillUsed);
    if (used.length === 0) {
      throw new Error(
        `No usable variables after impute=none filter (excluded=${excluded.join(",")})`,
      );
    }
  } else if (policy.impute !== "median") {
    throw new Error(`Unknown impute policy: ${policy.impute}`);
  }

  const usedIdx = used.map((u) => columns.indexOf(u));
  const matrix: number[][] = [];
  const imputedMask: boolean[][] = [];
  let nImputed = 0;

  const medians =
    policy.impute === "median"
      ? usedIdx.map((j) => {
          const colVals: number[] = [];
          for (let i = 0; i < nCand; i++) {
            const v = values[i]![j];
            if (isFiniteNumber(v)) colVals.push(v);
          }
          const m = median(colVals);
          return Number.isFinite(m) ? m : 0;
        })
      : usedIdx.map(() => 0);

  for (let i = 0; i < nCand; i++) {
    const row: number[] = [];
    const maskRow: boolean[] = [];
    for (let k = 0; k < usedIdx.length; k++) {
      const j = usedIdx[k]!;
      const v = values[i]![j];
      if (isFiniteNumber(v)) {
        row.push(v);
        maskRow.push(false);
      } else {
        row.push(medians[k]!);
        maskRow.push(true);
        nImputed++;
      }
    }
    matrix.push(row);
    imputedMask.push(maskRow);
  }

  if (policy.impute === "median") {
    for (let k = 0; k < used.length; k++) {
      const n = imputedMask.reduce((acc, r) => acc + (r[k] ? 1 : 0), 0);
      if (n > 0) {
        notes.push(`impute ${used[k]}: n=${n} median=${medians[k]}`);
      }
    }
  }

  return {
    matrix,
    candidates: [...candidates],
    usedVariables: used,
    excludedVariables: excluded,
    nCandidates: nCand,
    nImputedCells: nImputed,
    imputedMask,
    notes,
  };
}
