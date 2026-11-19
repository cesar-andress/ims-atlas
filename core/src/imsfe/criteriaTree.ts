/**
 * Phase A2 — IMSFE criteria trees as data (6×3 footwear, 7×3 olive oil + SUST).
 * Display order by weight never changes scores.
 */

export type CriterionCode =
  "COST" | "LOGI" | "COMM" | "ECON" | "POLI" | "CULT" | "SUST";

export type CriteriaTreePresetId = "imsfe_2025_footwear" | "imsfem_2025_olive";

export type CriteriaTree = {
  id: CriteriaTreePresetId;
  labelEn: string;
  labelEs: string;
  /** Criterion → variable codes (workbook order). */
  structure: Record<string, readonly string[]>;
  criterionWeights: Record<string, number>;
  variableWeights: Record<string, number>;
  /** DMP = benefit, IMP = cost (workbook formulas). */
  direction: Record<string, "benefit" | "cost">;
};

/** Footwear IMSFE 2025 (6×3) — expert means already in imsfeExpert2025. */
export const IMSFE_2025_FOOTWEAR: CriteriaTree = {
  id: "imsfe_2025_footwear",
  labelEn: "IMSFE 2025 footwear (6×3)",
  labelEs: "IMSFE 2025 calzado (6×3)",
  structure: {
    COST: ["PPAD", "INTC", "CIBC"],
    LOGI: ["LPIN", "CPTR", "ITTT"],
    COMM: ["CUTA", "CCTI", "IOEF"],
    ECON: ["CLI", "INAN", "UNRA"],
    POLI: ["FSIN", "INRI", "DEIN"],
    CULT: ["GLIN", "CPIN", "CUDI"],
  },
  criterionWeights: {
    COST: 0.21466666666666664,
    LOGI: 0.1846666666666667,
    COMM: 0.19333333333333333,
    ECON: 0.15333333333333335,
    POLI: 0.13066666666666668,
    CULT: 0.12333333333333332,
  },
  variableWeights: {
    PPAD: 0.43,
    INTC: 0.35,
    CIBC: 0.22000000000000006,
    LPIN: 0.4,
    CPTR: 0.26333333333333336,
    ITTT: 0.33666666666666667,
    CUTA: 0.49000000000000005,
    CCTI: 0.25333333333333335,
    IOEF: 0.2566666666666667,
    CLI: 0.34,
    INAN: 0.3466666666666667,
    UNRA: 0.3133333333333333,
    FSIN: 0.34333333333333343,
    INRI: 0.3733333333333333,
    DEIN: 0.2833333333333334,
    GLIN: 0.29333333333333333,
    CPIN: 0.32000000000000006,
    CUDI: 0.3866666666666667,
  },
  direction: {
    PPAD: "benefit",
    INTC: "cost",
    CIBC: "cost",
    LPIN: "benefit",
    CPTR: "benefit",
    ITTT: "cost",
    CUTA: "cost",
    CCTI: "cost",
    IOEF: "benefit",
    CLI: "benefit",
    INAN: "cost",
    UNRA: "cost",
    FSIN: "cost",
    INRI: "cost",
    DEIN: "benefit",
    GLIN: "benefit",
    CPIN: "benefit",
    CUDI: "cost",
  },
};

/** Olive-oil IMSFEM 2025 (7×3, +SUST; RQBC/ITBI swaps). Aggregated respondent row. */
export const IMSFEM_2025_OLIVE: CriteriaTree = {
  id: "imsfem_2025_olive",
  labelEn: "IMSFEM 2025 olive oil (7×3, + Sustainability)",
  labelEs: "IMSFEM 2025 aceite (7×3, + Sostenibilidad)",
  structure: {
    COST: ["PPAD", "INTC", "CIBC"],
    LOGI: ["LPIN", "RQBC", "ITTT"],
    COMM: ["CUTA", "ITBI", "IOEF"],
    ECON: ["CLI", "INAN", "UNRA"],
    POLI: ["FSIN", "INRI", "DEIN"],
    SUST: ["CADE", "GLCR", "GLSI"],
    CULT: ["GLIN", "CPIN", "CUDI"],
  },
  criterionWeights: {
    COST: 0.2330827067669173,
    LOGI: 0.162907268170426,
    COMM: 0.192982456140351,
    ECON: 0.14285714285714285,
    POLI: 0.10025062656641605,
    SUST: 0.0852130325814536,
    CULT: 0.08270676691729324,
  },
  variableWeights: {
    PPAD: 0.25,
    INTC: 0.3225,
    CIBC: 0.4275,
    LPIN: 0.35,
    RQBC: 0.4,
    ITTT: 0.25,
    CUTA: 0.4,
    ITBI: 0.355,
    IOEF: 0.245,
    CLI: 0.35,
    INAN: 0.4,
    UNRA: 0.25,
    FSIN: 0.25,
    INRI: 0.35,
    DEIN: 0.4,
    CADE: 0.3,
    GLCR: 0.3,
    GLSI: 0.4,
    GLIN: 0.295,
    CPIN: 0.45,
    CUDI: 0.255,
  },
  direction: {
    PPAD: "benefit",
    INTC: "cost",
    CIBC: "cost",
    LPIN: "benefit",
    RQBC: "benefit",
    ITTT: "cost",
    CUTA: "cost",
    ITBI: "cost",
    IOEF: "benefit",
    CLI: "benefit",
    INAN: "cost",
    UNRA: "cost",
    FSIN: "cost",
    INRI: "cost",
    DEIN: "benefit",
    CADE: "cost",
    GLCR: "cost",
    GLSI: "benefit",
    GLIN: "benefit",
    CPIN: "benefit",
    CUDI: "cost",
  },
};

export const CRITERIA_TREE_PRESETS: Record<CriteriaTreePresetId, CriteriaTree> = {
  imsfe_2025_footwear: IMSFE_2025_FOOTWEAR,
  imsfem_2025_olive: IMSFEM_2025_OLIVE,
};

export type RenormalizeResult = {
  weights: Record<string, number>;
  /** Sum before renormalisation. */
  rawSum: number;
  renormalised: boolean;
  note: string | null;
};

/** Divide by sum when sum ≠ 1; empty → {}. */
export function renormalizeWeights(weights: Record<string, number>): RenormalizeResult {
  const entries = Object.entries(weights).filter(([, w]) => Number.isFinite(w));
  const rawSum = entries.reduce((s, [, w]) => s + w, 0);
  if (entries.length === 0 || rawSum === 0) {
    return {
      weights: {},
      rawSum,
      renormalised: false,
      note: "no weights to renormalise",
    };
  }
  if (Math.abs(rawSum - 1) <= 1e-12) {
    return {
      weights: Object.fromEntries(entries),
      rawSum,
      renormalised: false,
      note: null,
    };
  }
  const scaled = Object.fromEntries(entries.map(([k, w]) => [k, w / rawSum]));
  return {
    weights: scaled,
    rawSum,
    renormalised: true,
    note: `weights sum to ${rawSum.toFixed(6)}; renormalised to 1`,
  };
}

/** SUMPRODUCT of weights × scores for keys present in both maps. */
export function weightedSum(
  weights: Record<string, number>,
  scores: Record<string, number>,
): number {
  let s = 0;
  for (const [k, w] of Object.entries(weights)) {
    const v = scores[k];
    if (Number.isFinite(w) && Number.isFinite(v)) s += w * (v as number);
  }
  return s;
}

export type ImsfeScoreResult = {
  criterionScores: Record<string, number>;
  total: number;
  criterionWeightsUsed: Record<string, number>;
  variableWeightsUsed: Record<string, number>;
  renormalizeNotes: string[];
};

/**
 * Workbook F2: criterion = Σ var_w × var_score; total = Σ crit_w × crit_score.
 * Weights are renormalised per block when they do not sum to 1.
 */
export function scoreImsfeTree(
  tree: CriteriaTree,
  variableScores: Record<string, number>,
  opts?: {
    criterionWeights?: Record<string, number>;
    variableWeights?: Record<string, number>;
  },
): ImsfeScoreResult {
  const varWIn = opts?.variableWeights ?? tree.variableWeights;
  const critWIn = opts?.criterionWeights ?? tree.criterionWeights;
  const notes: string[] = [];

  const criterionScores: Record<string, number> = {};
  const variableWeightsUsed: Record<string, number> = {};

  for (const [crit, vars] of Object.entries(tree.structure)) {
    const block: Record<string, number> = {};
    for (const v of vars) {
      if (v in varWIn) block[v] = varWIn[v]!;
    }
    const ren = renormalizeWeights(block);
    if (ren.renormalised && ren.note) notes.push(`${crit}: ${ren.note}`);
    Object.assign(variableWeightsUsed, ren.weights);
    const scores: Record<string, number> = {};
    for (const v of vars) {
      if (v in variableScores) scores[v] = variableScores[v]!;
    }
    criterionScores[crit] = weightedSum(ren.weights, scores);
  }

  const critRen = renormalizeWeights(
    Object.fromEntries(
      Object.keys(tree.structure)
        .filter((c) => c in critWIn)
        .map((c) => [c, critWIn[c]!]),
    ),
  );
  if (critRen.renormalised && critRen.note) {
    notes.push(`criteria: ${critRen.note}`);
  }

  return {
    criterionScores,
    total: weightedSum(critRen.weights, criterionScores),
    criterionWeightsUsed: critRen.weights,
    variableWeightsUsed,
    renormalizeNotes: notes,
  };
}

/** Display-only ordering by weight descending; does not mutate scores. */
export function orderKeysByWeight(
  weights: Record<string, number>,
  keys?: readonly string[],
): string[] {
  const list = keys ? [...keys] : Object.keys(weights);
  return list.sort((a, b) => {
    const wa = weights[a] ?? 0;
    const wb = weights[b] ?? 0;
    if (wb !== wa) return wb - wa;
    return a.localeCompare(b);
  });
}

/** Swap a variable inside a criterion (returns new tree; original untouched). */
export function swapVariableInCriterion(
  tree: CriteriaTree,
  criterion: string,
  fromVar: string,
  toVar: string,
  toDirection: "benefit" | "cost",
  toWeight?: number,
): CriteriaTree {
  const vars = tree.structure[criterion];
  if (!vars) throw new Error(`unknown criterion ${criterion}`);
  if (!vars.includes(fromVar)) {
    throw new Error(`${fromVar} not in ${criterion}`);
  }
  const nextVars = vars.map((v) => (v === fromVar ? toVar : v));
  const structure = { ...tree.structure, [criterion]: nextVars };
  const variableWeights = { ...tree.variableWeights };
  const w = variableWeights[fromVar] ?? toWeight ?? 1 / nextVars.length;
  delete variableWeights[fromVar];
  variableWeights[toVar] = toWeight ?? w;
  const direction = { ...tree.direction };
  delete direction[fromVar];
  direction[toVar] = toDirection;
  return { ...tree, structure, variableWeights, direction };
}
