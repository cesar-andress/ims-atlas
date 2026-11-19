import {
  scoreBlock,
  type ScoreBlockResult,
  type VariableSpec,
  type WeightSchemeId,
  type NormalizationId,
  type McdmId,
} from "@ims-atlas/core";
import { filterByRegion } from "../data/hsProducts";
import { loadDemoPanel, type DemoPanel } from "./demoPanel";

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
};

export type RankingViewModel = ScoreBlockResult & {
  panel: DemoPanel;
  warnings: string[];
  elapsedMs: number;
};

function subsetRows(
  panel: DemoPanel,
  keep: Set<string>,
  variableIds: string[],
): { candidates: string[]; values: (number | null)[][]; variables: VariableSpec[] } {
  const colIdx = variableIds.map((id) => panel.variables.findIndex((v) => v.id === id));
  const variables = variableIds.map((id, i) => {
    const v = panel.variables[colIdx[i]!];
    if (!v) throw new Error(`Unknown variable ${id}`);
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

export async function computeRanking(req: RankingRequest): Promise<RankingViewModel> {
  const panel = await loadDemoPanel();
  const warnings: string[] = [];

  if (req.origin && req.origin !== panel.origin) {
    warnings.push(
      `Demo panel is COL-only until redistributable release data ships; using ${panel.origin}.`,
    );
  }
  if (req.hs && req.hs !== panel.hs) {
    warnings.push(`Demo panel product is HS${panel.hs}; requested HS${req.hs}.`);
  }
  if (req.year && req.year !== panel.year) {
    warnings.push(`Demo panel year is ${panel.year}; requested ${req.year}.`);
  }

  let candidates = [...panel.candidates];
  candidates = filterByRegion(candidates, req.region);
  if (req.minImports !== undefined && req.minImports > 0) {
    candidates = candidates.filter(
      (iso) => (panel.importVolume[iso] ?? 0) >= req.minImports!,
    );
  }
  if (candidates.length < 20) {
    warnings.push(
      `Candidate filter left ${candidates.length} destinations; demo requires ≥20 — using full set.`,
    );
    candidates = [...panel.candidates];
  }

  const keep = new Set(candidates);
  const selected =
    req.variableIds && req.variableIds.length > 0
      ? req.variableIds.filter((id) => panel.variables.some((v) => v.id === id))
      : panel.variables.map((v) => v.id);

  const { candidates: rows, values, variables } = subsetRows(panel, keep, selected);

  const normalization = req.normalization ?? "minmax";
  const mcdm = req.mcdm ?? "wsm";
  const weightScheme = req.weightScheme ?? "expert_mean";
  const missingThreshold = req.missingThreshold ?? 0.2;

  const manualWeights =
    weightScheme === "manual" && req.factorWeights
      ? {
          factors: req.factorWeights,
          variablesWithin: Object.fromEntries(
            [...new Set(variables.map((v) => v.factor))].map((f) => {
              const vids = variables.filter((v) => v.factor === f).map((v) => v.id);
              const equal = 1 / Math.max(vids.length, 1);
              return [f, Object.fromEntries(vids.map((id) => [id, equal]))];
            }),
          ),
        }
      : undefined;

  const t0 = performance.now();
  const result = scoreBlock({
    candidates: rows,
    variables,
    values,
    normalization,
    mcdm,
    weightScheme,
    policy: { maxMissingShare: missingThreshold, minCandidates: 20 },
    ...(manualWeights ? { manualWeights } : {}),
  });
  const elapsedMs = performance.now() - t0;

  if (result.prepared.excludedVariables.length > 0) {
    warnings.push(
      `Excluded for missingness: ${result.prepared.excludedVariables.join(", ")}`,
    );
  }
  if (result.prepared.nImputedCells > 0) {
    warnings.push(`Median-imputed cells: ${result.prepared.nImputedCells}`);
  }

  return { ...result, panel, warnings, elapsedMs };
}
