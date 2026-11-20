import {
  applyZeroPolicy,
  combinedScore,
  CRITERIA_TREE_PRESETS,
  detectNearBinaryScaled,
  dualPreselect,
  IMSFE_2025_SOURCE_NOTES,
  normalizeEoc,
  normalizeImsfe,
  normalizeRatioLegacy,
  parseHsCode,
  scaleCostWithPolicy,
  scoreBlock,
  warnFewImportersAtHs6,
  type CriteriaTree,
  type CriteriaTreePresetId,
  type ScoreBlockResult,
  type VariableSpec,
  type WeightSchemeId,
  type NormalizationId,
  type McdmId,
  type ZeroPolicy,
} from "@ims-atlas/core";
import { baciVolumesFor } from "../data/baciImportCache";
import { filterByRegion } from "../data/hsProducts";
import { DemoPanelPendingError, loadDemoPanel, type DemoPanel } from "./demoPanel";

export type RankingRequest = {
  origin?: string | undefined;
  hs?: string | undefined;
  year?: number | undefined;
  region?: string | undefined;
  minImports?: number | undefined;
  variableIds?: string[] | undefined;
  normalization?: NormalizationId | undefined;
  mcdm?: McdmId | undefined;
  weightScheme?: WeightSchemeId | undefined;
  missingThreshold?: number | undefined;
  factorWeights?: Record<string, number> | undefined;
  /** ADVANCE — method family / criteria tree. */
  methodFamily?:
    "imsfe_2025" | "imsfem_2025_olive" | "smi_2018" | "smi_2020" | undefined;
  zeroPolicy?: "epsilon" | "minmax" | "rank" | "offset_ratio" | undefined;
  zeroEpsilon?: number | undefined;
  zeroOffsetC?: number | undefined;
  culturalDistanceKind?: "sum_of_sums" | "sum_abs_diff" | "kogut_singh" | undefined;
  imputationMethod?:
    | "none"
    | "locf"
    | "linear_interp"
    | "log_linear_trend"
    | "cross_section"
    | undefined;
  combinedEocWeight?: number | undefined;
  combinedEocNorm?: "ratio_to_max" | "times_5" | undefined;
  preselectPick?: "imports" | "openness" | "union" | undefined;
  includeOriginInPreselect?: boolean | undefined;
  preselectMode?: "top_n" | "cumulative_share" | undefined;
  preselectTopN?: number | undefined;
  preselectCumShare?: number | undefined;
};

export type RankingViewModel = ScoreBlockResult & {
  panel: DemoPanel;
  warnings: string[];
  elapsedMs: number;
  /** Present when combined IMSFE+EOC re-ranking was applied. */
  combined?: {
    a: number;
    scores: Record<string, number>;
    eocWarnings: string[];
  };
};

function treeForFamily(family: RankingRequest["methodFamily"]): CriteriaTree | null {
  if (family === "imsfe_2025") {
    return CRITERIA_TREE_PRESETS.imsfe_2025_footwear;
  }
  if (family === "imsfem_2025_olive") {
    return CRITERIA_TREE_PRESETS.imsfem_2025_olive;
  }
  return null;
}

function treePresetId(
  family: RankingRequest["methodFamily"],
): CriteriaTreePresetId | null {
  if (family === "imsfe_2025") return "imsfe_2025_footwear";
  if (family === "imsfem_2025_olive") return "imsfem_2025_olive";
  return null;
}

function subsetRows(
  panel: DemoPanel,
  keep: Set<string>,
  variableIds: string[],
): { candidates: string[]; values: (number | null)[][]; variables: VariableSpec[] } {
  const colIdx = variableIds.map((id) => panel.variables.findIndex((v) => v.id === id));
  const variables = variableIds.map((id, i) => {
    const v = panel.variables[colIdx[i]!];
    if (!v) throw new Error(`Unknown variable ${id}`);
    // Prefer tree direction when the panel still carries a generic factor label.
    return v;
  });
  const candidates: string[] = [];
  const values: (number | null)[][] = [];
  for (let i = 0; i < panel.candidates.length; i++) {
    const iso = panel.candidates[i]!;
    if (!keep.has(iso)) continue;
    candidates.push(iso);
    const row = panel.values[i]!;
    values.push(colIdx.map((j) => row[j]!));
  }
  return { candidates, values, variables };
}

function applyTreeDirections(
  variables: VariableSpec[],
  tree: CriteriaTree | null,
): VariableSpec[] {
  if (!tree) return variables;
  return variables.map((v) => {
    const d = tree.direction[v.id];
    const factor =
      Object.entries(tree.structure).find(([, ids]) => ids.includes(v.id))?.[0] ??
      v.factor;
    return {
      id: v.id,
      factor,
      direction: d ?? v.direction,
    };
  });
}

/** Map Jose workbook codes onto panel/release ids (open-candidate aliases). */
function resolveJoseToPanelId(joseId: string, panelIds: Set<string>): string | null {
  if (panelIds.has(joseId)) return joseId;
  const hardcoded: Record<string, string> = {
    CUDI: "CULT",
    CULT: "CULT",
    LPIN: "LPI",
    CUTA: "TARIF",
    CLI: "PLI",
    INAN: "INFL",
    UNRA: "UNEMP",
    CADE: "CO2PC",
  };
  const direct = hardcoded[joseId];
  if (direct && panelIds.has(direct)) return direct;
  const note = IMSFE_2025_SOURCE_NOTES[joseId];
  const cand = note?.openCandidate?.split("/")[0]?.trim();
  if (cand && panelIds.has(cand)) return cand;
  return null;
}

/**
 * Expand a criteria tree against the panel: jose id → panel id, with weights
 * carried onto the resolved panel variable.
 */
function resolveTreeAgainstPanel(
  tree: CriteriaTree,
  panelIds: Set<string>,
): {
  panelVarIds: string[];
  /** panelVarId → { criterion, weight, direction, joseId } */
  meta: Map<
    string,
    { criterion: string; weight: number; direction: "benefit" | "cost"; joseId: string }
  >;
  missingJose: string[];
} {
  const meta = new Map<
    string,
    { criterion: string; weight: number; direction: "benefit" | "cost"; joseId: string }
  >();
  const missingJose: string[] = [];
  for (const [crit, vids] of Object.entries(tree.structure)) {
    for (const joseId of vids) {
      const panelId = resolveJoseToPanelId(joseId, panelIds);
      if (!panelId) {
        missingJose.push(joseId);
        continue;
      }
      const prev = meta.get(panelId);
      const w = tree.variableWeights[joseId] ?? 0;
      // Keep first mapping; if collision, keep higher weight.
      if (!prev || w > prev.weight) {
        meta.set(panelId, {
          criterion: crit,
          weight: w,
          direction: tree.direction[joseId] ?? "benefit",
          joseId,
        });
      }
    }
  }
  return { panelVarIds: [...meta.keys()], meta, missingJose };
}

function manualWeightsFromResolved(
  tree: CriteriaTree,
  meta: Map<
    string,
    { criterion: string; weight: number; direction: "benefit" | "cost"; joseId: string }
  >,
): {
  factors: Record<string, number>;
  variablesWithin: Record<string, Record<string, number>>;
} {
  const factors: Record<string, number> = {};
  const variablesWithin: Record<string, Record<string, number>> = {};
  for (const [panelId, m] of meta) {
    factors[m.criterion] = tree.criterionWeights[m.criterion] ?? 0;
    const block = variablesWithin[m.criterion] ?? {};
    block[panelId] = m.weight;
    variablesWithin[m.criterion] = block;
  }
  for (const crit of Object.keys(variablesWithin)) {
    const block = variablesWithin[crit]!;
    const sum = Object.values(block).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      variablesWithin[crit] = Object.fromEntries(
        Object.entries(block).map(([k, w]) => [k, w / sum]),
      );
    }
  }
  const fSum = Object.values(factors).reduce((a, b) => a + b, 0);
  if (fSum > 0) {
    for (const k of Object.keys(factors)) factors[k] = factors[k]! / fSum;
  }
  return { factors, variablesWithin };
}

/**
 * Criterion weights chosen by hand replace the criteria-tree (expert) weights.
 * Returns `base` unchanged when `override` names none of the tree criteria, so
 * the default expert path (and the golden fixtures) are not affected.
 */
export function overrideCriterionWeights(
  base: Record<string, number>,
  override: Record<string, number> | undefined,
): Record<string, number> {
  if (!override) return base;
  const keys = Object.keys(base);
  if (!keys.some((k) => override[k] !== undefined)) return base;
  const raw = Object.fromEntries(
    keys.map((k) => [k, Math.max(0, override[k] ?? 0)] as const),
  );
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  if (sum <= 0) return base;
  return Object.fromEntries(keys.map((k) => [k, raw[k]! / sum] as const));
}

function buildZeroPolicy(req: RankingRequest): ZeroPolicy {
  const kind = req.zeroPolicy ?? "epsilon";
  if (kind === "minmax") return { kind: "minmax" };
  if (kind === "rank") return { kind: "rank" };
  if (kind === "offset_ratio") {
    return { kind: "offset_ratio", c: req.zeroOffsetC ?? 0.001 };
  }
  return { kind: "epsilon", epsilon: req.zeroEpsilon ?? 0.1 };
}

/**
 * Cost zero-policy before scoring.
 * - epsilon / offset_ratio: mutate raw (zeros → ε or x→x+c); scoreBlock normalises.
 * - minmax / rank: replace column with a finished 0–10 scale and flip to benefit
 *   so scoreBlock does not invert again.
 */
function applyZeroPoliciesToValues(
  values: (number | null)[][],
  variables: VariableSpec[],
  policy: ZeroPolicy,
  warnings: string[],
): { values: (number | null)[][]; variables: VariableSpec[] } {
  const nRows = values.length;
  const nCols = variables.length;
  const out = values.map((row) => [...row]);
  const nextVars = variables.map((v) => ({ ...v }));
  for (let j = 0; j < nCols; j++) {
    const spec = nextVars[j]!;
    if (spec.direction !== "cost") continue;
    const series = values.map((row) => row[j]!);
    if (policy.kind === "minmax" || policy.kind === "rank") {
      const scaled = scaleCostWithPolicy(series, policy, 10);
      for (let i = 0; i < nRows; i++) {
        const v = scaled[i]!;
        out[i]![j] = Number.isFinite(v) ? v : null;
      }
      nextVars[j] = { ...spec, direction: "benefit" };
      continue;
    }
    const prepared = applyZeroPolicy(series, policy);
    for (let i = 0; i < nRows; i++) out[i]![j] = prepared[i] ?? null;
    const probe = normalizeRatioLegacy(prepared, "cost", 10);
    const near = detectNearBinaryScaled(probe, spec.id);
    if (near) warnings.push(near.message.en);
  }
  return { values: out, variables: nextVars };
}

function columnValues(
  panel: DemoPanel,
  varId: string,
  isos: string[],
): Record<string, number | null> {
  const j = panel.variables.findIndex((v) => v.id === varId);
  const out: Record<string, number | null> = {};
  if (j < 0) return out;
  for (const iso of isos) {
    const i = panel.candidates.indexOf(iso);
    if (i < 0) {
      out[iso] = null;
      continue;
    }
    const v = panel.values[i]![j];
    out[iso] = typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  return out;
}

function hsDigits(code: string | undefined): string {
  return (code ?? "").replace(/\D/g, "");
}

export async function computeRanking(req: RankingRequest): Promise<RankingViewModel> {
  const panel = await loadDemoPanel();
  const warnings: string[] = [];
  const tree = treeForFamily(req.methodFamily);
  const presetId = treePresetId(req.methodFamily);

  const reqHs = hsDigits(req.hs);
  const panelHs = hsDigits(panel.hs);
  // Exact HS only: HS 6401 must not reuse HS 64 panel numbers.
  if (reqHs && panelHs && reqHs !== panelHs) {
    throw new DemoPanelPendingError(
      reqHs.length > 2
        ? `Faltan métricas de producto para HS ${req.hs} (el panel publicado es HS ${panel.hs}). Revise Datos → Estado.`
        : `Faltan datos de comercio de BACI para HS ${req.hs}. Revise Datos → Estado.`,
    );
  }
  if (req.origin && req.origin !== panel.origin) {
    warnings.push(
      `Demo panel is COL-only until redistributable release data ships; using ${panel.origin}.`,
    );
  }
  if (req.year && req.year !== panel.year) {
    warnings.push(`Demo panel year is ${panel.year}; requested ${req.year}.`);
  }
  if (presetId) {
    warnings.push(`Criteria tree: ${presetId}`);
  }

  const hsInfo = req.hs ? parseHsCode(req.hs) : null;
  if (hsInfo) {
    const few = warnFewImportersAtHs6(panel.candidates.length, hsInfo.level);
    if (few) warnings.push(few);
  }

  const baciVolumes = baciVolumesFor(req.hs, req.year);
  const importVolume = baciVolumes ?? panel.importVolume;
  if (!baciVolumes) {
    warnings.push(
      "Pre-selection uses demo-panel import proxies (BACI trade parquet not loaded).",
    );
  } else {
    warnings.push("Pre-selection import shares from BACI release trade chapter.");
  }

  let candidates = [...panel.candidates];
  candidates = filterByRegion(candidates, req.region);
  if (req.minImports !== undefined && req.minImports > 0) {
    candidates = candidates.filter(
      (iso) => (importVolume[iso] ?? 0) >= req.minImports!,
    );
  }

  // A7 — pre-selection A/B when the user set a mode or pick.
  if (req.preselectMode !== undefined || req.preselectPick !== undefined) {
    const eocCol = columnValues(panel, "EOC", panel.candidates);
    const importRows = panel.candidates.map((iso3) => ({
      iso3,
      importValue: importVolume[iso3] ?? 0,
    }));
    const opennessRows = panel.candidates
      .map((iso3) => {
        const eoc = eocCol[iso3];
        return eoc != null && Number.isFinite(eoc) ? { iso3, eoc } : null;
      })
      .filter((r): r is { iso3: string; eoc: number } => r != null);
    const dual = dualPreselect({
      importRows,
      opennessRows,
      importMode: req.preselectMode ?? "top_n",
      topN: req.preselectTopN ?? 30,
      cumulativeShare: req.preselectCumShare ?? 0.8,
      pick: req.preselectPick ?? "imports",
      originIso3: req.origin ?? panel.origin,
      includeOrigin: req.includeOriginInPreselect === true,
    });
    const chosen = new Set(dual.chosen);
    const filtered = candidates.filter((c) => chosen.has(c));
    if (filtered.length >= 20) {
      candidates = filtered;
      warnings.push(
        `Pre-selection ${req.preselectPick ?? "imports"}: ${candidates.length} markets`,
      );
    } else {
      warnings.push(
        `Pre-selection left ${filtered.length} destinations (<20); keeping prior filter (${candidates.length}).`,
      );
    }
  }

  if (candidates.length < 20) {
    warnings.push(
      `Candidate filter left ${candidates.length} destinations; demo requires ≥20 — using full set.`,
    );
    candidates = [...panel.candidates];
  }

  const keep = new Set(candidates);
  const panelIds = new Set(panel.variables.map((v) => v.id));

  let selected: string[];
  let resolvedMeta: ReturnType<typeof resolveTreeAgainstPanel>["meta"] | null = null;
  if (tree) {
    const resolved = resolveTreeAgainstPanel(tree, panelIds);
    resolvedMeta = resolved.meta;
    if (resolved.missingJose.length > 0) {
      warnings.push(
        `Tree variables not in panel (skipped): ${resolved.missingJose.join(", ")}`,
      );
    }
    selected =
      req.variableIds && req.variableIds.length > 0
        ? req.variableIds.filter((id) => resolved.meta.has(id) || panelIds.has(id))
        : resolved.panelVarIds;
    // Prefer resolved tree ids; intersect with explicit picks when provided.
    if (req.variableIds && req.variableIds.length > 0) {
      selected = selected.filter((id) => resolved.meta.has(id));
    }
    if (selected.length === 0) {
      selected = panel.variables.map((v) => v.id);
      resolvedMeta = null;
      warnings.push("No tree variables available; falling back to panel variables.");
    } else {
      warnings.push(
        `Using ${selected.length} panel variables mapped from criteria tree`,
      );
    }
  } else {
    selected =
      req.variableIds && req.variableIds.length > 0
        ? req.variableIds.filter((id) => panelIds.has(id))
        : panel.variables.map((v) => v.id);
  }

  const subset = subsetRows(panel, keep, selected);
  const rows = subset.candidates;
  let { values, variables } = subset;
  if (resolvedMeta) {
    variables = variables.map((v) => {
      const m = resolvedMeta!.get(v.id);
      if (!m) return v;
      return { id: v.id, factor: m.criterion, direction: m.direction };
    });
  } else {
    variables = applyTreeDirections(variables, tree);
  }

  // Zero policy only when the user set it (keeps golden / default path unchanged).
  if (req.zeroPolicy !== undefined) {
    const zeroPolicy = buildZeroPolicy(req);
    ({ values, variables } = applyZeroPoliciesToValues(
      values,
      variables,
      zeroPolicy,
      warnings,
    ));
    warnings.push(`Zero policy: ${zeroPolicy.kind}`);
  }

  const cultureKind = req.culturalDistanceKind;
  if (
    cultureKind !== undefined &&
    cultureKind !== "sum_of_sums" &&
    variables.some((v) => v.id === "CUDI" || v.id === "CULT")
  ) {
    warnings.push(
      `Cultural distance kind=${cultureKind}: panel CUDI is the workbook column (sum-of-sums). Hofstede recomputation is not applied without per-dimension inputs.`,
    );
  }

  // Residual gaps: legacy default is median (golden). Explicit "none" refuses fill.
  const imputationMethod = req.imputationMethod;
  let imputePolicy: "median" | "none" = "median";
  if (imputationMethod === "none") {
    imputePolicy = "none";
  } else if (
    imputationMethod === "locf" ||
    imputationMethod === "linear_interp" ||
    imputationMethod === "log_linear_trend" ||
    imputationMethod === "cross_section"
  ) {
    imputePolicy = "median";
    warnings.push(
      `Imputation method=${imputationMethod} needs multi-year series; residual gaps use column median.`,
    );
  }

  const normalization = req.normalization ?? "minmax";
  const mcdm = req.mcdm ?? "wsm";
  let weightScheme = req.weightScheme ?? "expert_mean";
  const missingThreshold = req.missingThreshold ?? 0.2;

  let manualWeights:
    | {
        factors: Record<string, number>;
        variablesWithin: Record<string, Record<string, number>>;
      }
    | undefined;

  if (tree && resolvedMeta && resolvedMeta.size > 0) {
    manualWeights = manualWeightsFromResolved(tree, resolvedMeta);
    if (weightScheme === "manual") {
      manualWeights = {
        ...manualWeights,
        factors: overrideCriterionWeights(manualWeights.factors, req.factorWeights),
      };
    }
    weightScheme = "manual";
  } else if (weightScheme === "manual" && req.factorWeights) {
    manualWeights = {
      factors: req.factorWeights,
      variablesWithin: Object.fromEntries(
        [...new Set(variables.map((v) => v.factor))].map((f) => {
          const vids = variables.filter((v) => v.factor === f).map((v) => v.id);
          const equal = 1 / Math.max(vids.length, 1);
          return [f, Object.fromEntries(vids.map((id) => [id, equal]))];
        }),
      ),
    };
  }

  const t0 = performance.now();
  let result = scoreBlock({
    candidates: rows,
    variables,
    values,
    normalization,
    mcdm,
    weightScheme,
    policy: {
      maxMissingShare: missingThreshold,
      minCandidates: 20,
      impute: imputePolicy,
    },
    ...(manualWeights ? { manualWeights } : {}),
  });

  let combined: RankingViewModel["combined"];
  if (
    req.combinedEocWeight !== undefined &&
    Number.isFinite(req.combinedEocWeight) &&
    req.combinedEocWeight >= 0 &&
    req.combinedEocWeight <= 1
  ) {
    const eocRaw = columnValues(panel, "EOC", result.prepared.candidates);
    const eocMap: Record<string, number> = {};
    for (const iso of result.prepared.candidates) {
      const v = eocRaw[iso];
      if (v != null && Number.isFinite(v)) eocMap[iso] = v;
    }
    const imsfeMap = Object.fromEntries(result.ranking.map((r) => [r.iso3, r.score]));
    if (Object.keys(eocMap).length >= 5) {
      const a = req.combinedEocWeight;
      const imsfeNorm = normalizeImsfe(imsfeMap);
      const { values: eocNorm, warnings: eocWarnings } = normalizeEoc(
        eocMap,
        req.combinedEocNorm ?? "ratio_to_max",
      );
      const scores = combinedScore(imsfeNorm, eocNorm, a);
      const order = Object.entries(scores)
        .filter(([, v]) => Number.isFinite(v))
        .sort((x, y) => y[1]! - x[1]! || x[0].localeCompare(y[0]));
      const ranking = order.map(([iso3, score], i) => ({
        iso3,
        score: score as number,
        rank: i + 1,
      }));
      const scoreArr = result.prepared.candidates.map(
        (iso) => scores[iso] ?? Number.NaN,
      );
      result = { ...result, scores: scoreArr, ranking };
      combined = { a, scores, eocWarnings };
      for (const w of eocWarnings) warnings.push(w);
      warnings.push(`Combined score a·EOC+(1−a)·IMSFE with a=${a.toFixed(2)}`);
    } else {
      warnings.push("Combined score skipped: fewer than 5 EOC values in panel.");
    }
  }

  const elapsedMs = performance.now() - t0;

  if (result.prepared.excludedVariables.length > 0) {
    warnings.push(
      `Excluded for missingness: ${result.prepared.excludedVariables.join(", ")}`,
    );
  }
  if (result.prepared.nImputedCells > 0) {
    warnings.push(`Median-imputed cells: ${result.prepared.nImputedCells}`);
  }

  return {
    ...result,
    panel,
    warnings,
    elapsedMs,
    ...(combined ? { combined } : {}),
  };
}
