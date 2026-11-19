/**
 * Weight schemes (ports ``imsfe.weights`` for equal/manual/expert/entropy/CRITIC).
 */

import { column, pearson, stdSample } from "./math.js";
import {
  EXPERT_FACTOR_MEANS,
  EXPERT_VARIABLE_MEANS,
  LEGACY_FACTOR_MAP,
} from "./presets/imsfeExpert2025.js";
import type {
  Direction,
  HierarchicalWeights,
  VariableSpec,
  WeightSchemeId,
} from "./types.js";

function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

function renormalizeRecord(rec: Record<string, number>): Record<string, number> {
  const total = sum(Object.values(rec));
  if (total <= 0) throw new Error("cannot renormalise empty/zero weights");
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = v / total;
  return out;
}

export function validateWeights(w: HierarchicalWeights): HierarchicalWeights {
  const fvals = Object.values(w.factors);
  if (fvals.some((x) => x < 0)) throw new Error("factor weights must be non-negative");
  if (Math.abs(sum(fvals) - 1) > 1e-8) {
    throw new Error(`factor weights must sum to 1; got ${sum(fvals)}`);
  }
  for (const [factor, vw] of Object.entries(w.variablesWithin)) {
    const vals = Object.values(vw);
    if (vals.some((x) => x < 0)) {
      throw new Error(`variable weights in ${factor} must be non-negative`);
    }
    if (Math.abs(sum(vals) - 1) > 1e-8) {
      throw new Error(`variable weights in ${factor} must sum to 1; got ${sum(vals)}`);
    }
  }
  return w;
}

export function flatWeights(
  w: HierarchicalWeights,
  variableIds?: readonly string[],
): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const [factor, fw] of Object.entries(w.factors)) {
    const vw = w.variablesWithin[factor];
    if (!vw) continue;
    for (const [vid, weight] of Object.entries(vw)) {
      parts[vid] = fw * weight;
    }
  }
  if (variableIds === undefined) return parts;
  const out: Record<string, number> = {};
  for (const id of variableIds) out[id] = parts[id] ?? 0;
  const total = sum(Object.values(out));
  if (total > 0) {
    for (const id of variableIds) out[id] = out[id]! / total;
  }
  return out;
}

export function restrictWeights(
  w: HierarchicalWeights,
  available: readonly string[],
): HierarchicalWeights {
  const notes = [...w.notes];
  const newWithin: Record<string, Record<string, number>> = {};
  const factorMass: Record<string, number> = {};
  const avail = new Set(available);
  for (const [factor, fw] of Object.entries(w.factors)) {
    const vw = w.variablesWithin[factor] ?? {};
    const keep = Object.keys(vw).filter((v) => avail.has(v));
    if (keep.length === 0) {
      notes.push(`factor ${factor} dropped (no available variables)`);
      continue;
    }
    const sub: Record<string, number> = {};
    for (const v of keep) sub[v] = vw[v]!;
    newWithin[factor] = renormalizeRecord(sub);
    factorMass[factor] = fw;
  }
  if (Object.keys(factorMass).length === 0) {
    throw new Error("No variables left after restricting weights");
  }
  return validateWeights({
    factors: renormalizeRecord(factorMass),
    variablesWithin: newWithin,
    scheme: w.scheme,
    notes,
  });
}

function groupByFactor(variables: readonly VariableSpec[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const v of variables) {
    const list = map.get(v.factor) ?? [];
    list.push(v.id);
    map.set(v.factor, list);
  }
  return map;
}

export function weightsEqual(variables: readonly VariableSpec[]): HierarchicalWeights {
  const byFactor = groupByFactor(variables);
  const factors = [...byFactor.keys()].sort();
  if (factors.length === 0) throw new Error("no variables for equal weights");
  const fw: Record<string, number> = {};
  const within: Record<string, Record<string, number>> = {};
  for (const f of factors) {
    fw[f] = 1 / factors.length;
    const vids = byFactor.get(f)!;
    const vw: Record<string, number> = {};
    for (const id of vids) vw[id] = 1 / vids.length;
    within[f] = vw;
  }
  return validateWeights({
    factors: fw,
    variablesWithin: within,
    scheme: "equal",
    notes: [],
  });
}

/** Manual hierarchical weights (already normalised by the caller or renormalised here). */
export function weightsManual(
  factors: Record<string, number>,
  variablesWithin: Record<string, Record<string, number>>,
): HierarchicalWeights {
  const fw = renormalizeRecord({ ...factors });
  const within: Record<string, Record<string, number>> = {};
  for (const [f, vw] of Object.entries(variablesWithin)) {
    within[f] = renormalizeRecord({ ...vw });
  }
  return validateWeights({
    factors: fw,
    variablesWithin: within,
    scheme: "manual",
    notes: [],
  });
}

export function weightsExpertMean(
  variables: readonly VariableSpec[],
): HierarchicalWeights {
  const notes: string[] = [];
  const factorsPresent = [...new Set(variables.map((v) => v.factor))];
  const mapped: Record<string, number> = {};
  const unmapped: string[] = [];
  for (const f of factorsPresent) {
    const legacy = LEGACY_FACTOR_MAP[f];
    if (legacy && EXPERT_FACTOR_MEANS[legacy] !== undefined) {
      mapped[f] = EXPERT_FACTOR_MEANS[legacy]!;
    } else {
      unmapped.push(f);
    }
  }
  unmapped.sort();

  let fw: Record<string, number>;
  if (Object.keys(mapped).length > 0) {
    const mappedNorm = renormalizeRecord(mapped);
    const nAll = Object.keys(mapped).length + unmapped.length;
    const mappedMass = Object.keys(mapped).length / nAll;
    const unmappedMass = 1 - mappedMass;
    fw = {};
    for (const [f, w] of Object.entries(mappedNorm)) fw[f] = w * mappedMass;
    if (unmapped.length > 0) {
      const share = unmappedMass / unmapped.length;
      for (const f of unmapped) {
        fw[f] = share;
        notes.push(
          `factor ${f}: no legacy expert mapping; equal residual share=${share.toFixed(4)}`,
        );
      }
    }
    fw = renormalizeRecord(fw);
  } else {
    return {
      ...weightsEqual(variables),
      scheme: "expert_mean",
      notes: ["no legacy factor mapping available; using equal factor weights"],
    };
  }

  const within: Record<string, Record<string, number>> = {};
  for (const factor of Object.keys(fw)) {
    const vids = variables.filter((v) => v.factor === factor).map((v) => v.id);
    const known: Record<string, number> = {};
    const unknown: string[] = [];
    for (const vid of vids) {
      if (EXPERT_VARIABLE_MEANS[vid] !== undefined) {
        known[vid] = EXPERT_VARIABLE_MEANS[vid]!;
      } else {
        unknown.push(vid);
      }
    }
    if (Object.keys(known).length > 0 && unknown.length > 0) {
      const knownNorm = renormalizeRecord(known);
      const knownMass = Object.keys(known).length / vids.length;
      const unknownMass = 1 - knownMass;
      const parts: Record<string, number> = {};
      for (const [vid, w] of Object.entries(knownNorm)) parts[vid] = w * knownMass;
      const uShare = unknownMass / unknown.length;
      for (const vid of unknown) {
        parts[vid] = uShare;
        notes.push(
          `${vid}: no expert weight; equal share inside ${factor} (${uShare.toFixed(4)})`,
        );
      }
      within[factor] = parts;
    } else if (Object.keys(known).length > 0) {
      within[factor] = renormalizeRecord(known);
    } else {
      const parts: Record<string, number> = {};
      for (const vid of vids) {
        parts[vid] = 1 / vids.length;
        notes.push(
          `${vid}: no expert weight; equal share inside ${factor} (${(1 / vids.length).toFixed(4)})`,
        );
      }
      within[factor] = parts;
    }
  }

  return validateWeights({
    factors: fw,
    variablesWithin: within,
    scheme: "expert_mean",
    notes,
  });
}

/** pymcdm sum_normalization (profit) then entropy weights. */
export function weightsEntropyFlat(matrix: readonly (readonly number[])[]): number[] {
  const n = matrix.length;
  const m = matrix[0]?.length ?? 0;
  if (n === 0 || m === 0) throw new Error("entropy weights require a non-empty matrix");

  // Column-wise shift to strictly positive (imsfe._shift_nonnegative).
  const shifted: number[][] = matrix.map((row) => [...row]);
  for (let j = 0; j < m; j++) {
    let colMin = Infinity;
    for (let i = 0; i < n; i++) colMin = Math.min(colMin, shifted[i]![j]!);
    for (let i = 0; i < n; i++) shifted[i]![j] = shifted[i]![j]! - colMin + 1e-12;
  }

  // sum_normalization per column (profit).
  const nmatrix: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let j = 0; j < m; j++) {
    let colSum = 0;
    for (let i = 0; i < n; i++) colSum += shifted[i]![j]!;
    for (let i = 0; i < n; i++) nmatrix[i]![j] = shifted[i]![j]! / colSum;
  }

  const entropies = new Array<number>(m);
  const logN = Math.log(n);
  for (let j = 0; j < m; j++) {
    const col = column(nmatrix, j);
    if (col.some((x) => x === 0)) {
      entropies[j] = 0;
    } else {
      let e = 0;
      for (const x of col) e += x * Math.log(x);
      entropies[j] = -e / logN;
    }
  }
  const E = entropies.map((e) => 1 - e);
  const eSum = sum(E);
  return E.map((e) => e / eSum);
}

/** pymcdm critic_weights (pymcdm ignores criterion types). */
export function weightsCriticFlat(matrix: readonly (readonly number[])[]): number[] {
  const n = matrix.length;
  const m = matrix[0]?.length ?? 0;
  if (n === 0 || m === 0) throw new Error("critic weights require a non-empty matrix");

  // minmax_normalization with criteria_types=None => all profit.
  const nmatrix: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let j = 0; j < m; j++) {
    const col = column(matrix, j);
    const vmin = Math.min(...col);
    const vmax = Math.max(...col);
    if (vmin === vmax) {
      for (let i = 0; i < n; i++) nmatrix[i]![j] = 1;
    } else {
      for (let i = 0; i < n; i++) {
        nmatrix[i]![j] = (col[i]! - vmin) / (vmax - vmin);
      }
    }
  }

  const stds = Array.from({ length: m }, (_, j) => stdSample(column(nmatrix, j)));
  const coef: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      coef[i]![j] = pearson(column(nmatrix, i), column(nmatrix, j));
    }
  }
  const C = new Array<number>(m);
  for (let j = 0; j < m; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += 1 - coef[i]![j]!;
    C[j] = stds[j]! * s;
  }
  const cSum = sum(C);
  return C.map((c) => c / cSum);
}

export function flatToHierarchical(
  flat: Readonly<Record<string, number>>,
  variables: readonly VariableSpec[],
  scheme: string,
): HierarchicalWeights {
  const within: Record<string, Record<string, number>> = {};
  const factorMass: Record<string, number> = {};
  const factors = [...new Set(variables.map((v) => v.factor))];
  for (const factor of factors) {
    const vids = variables
      .filter((v) => v.factor === factor && flat[v.id] !== undefined)
      .map((v) => v.id);
    if (vids.length === 0) continue;
    const sub: Record<string, number> = {};
    for (const id of vids) sub[id] = Math.max(0, flat[id]!);
    const mass = sum(Object.values(sub));
    if (mass <= 0) {
      for (const id of vids) sub[id] = 1 / vids.length;
      within[factor] = sub;
      factorMass[factor] = 1;
    } else {
      within[factor] = renormalizeRecord(sub);
      factorMass[factor] = mass;
    }
  }
  return validateWeights({
    factors: renormalizeRecord(factorMass),
    variablesWithin: within,
    scheme,
    notes: [],
  });
}

export function getWeights(
  scheme: WeightSchemeId,
  variables: readonly VariableSpec[],
  opts?: {
    matrix?: readonly (readonly number[])[];
    columns?: readonly string[];
    directions?: Readonly<Record<string, Direction>>;
    manual?: {
      factors: Record<string, number>;
      variablesWithin: Record<string, Record<string, number>>;
    };
  },
): HierarchicalWeights {
  if (scheme === "equal") return weightsEqual(variables);
  if (scheme === "manual") {
    if (!opts?.manual) throw new Error("manual weights require opts.manual");
    return weightsManual(opts.manual.factors, opts.manual.variablesWithin);
  }
  if (scheme === "expert_mean") return weightsExpertMean(variables);
  if (scheme === "entropy" || scheme === "critic") {
    if (!opts?.matrix || opts.matrix.length === 0) {
      throw new Error(`${scheme} weights require a non-empty matrix`);
    }
    const cols = opts.columns ?? variables.map((v) => v.id);
    const flatArr =
      scheme === "entropy"
        ? weightsEntropyFlat(opts.matrix)
        : weightsCriticFlat(opts.matrix);
    const flat: Record<string, number> = {};
    cols.forEach((c, i) => {
      flat[c] = flatArr[i]!;
    });
    return flatToHierarchical(flat, variables, scheme);
  }
  throw new Error(`Unknown weight scheme: ${scheme}`);
}
