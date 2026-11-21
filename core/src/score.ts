/**
 * High-level origin-year scoring pipeline: prepare → weights → normalise → MCDM.
 */

import { applyCatalogTransforms, dropCoWeightedAliases } from "./catalogTransform.js";
import { factorContributions, score as scoreMcdm } from "./mcdm.js";
import { compareScoreDescending } from "./math.js";
import { prepareBlock, type PrepareBlockInput } from "./missing.js";
import { normalizeMatrix } from "./normalize.js";
import type {
  Direction,
  HierarchicalWeights,
  McdmId,
  MissingDataPolicy,
  NormalizationId,
  PreparedBlock,
  VariableSpec,
  WeightSchemeId,
} from "./types.js";
import { getWeights, restrictWeights } from "./weights.js";

export type ScoreBlockInput = {
  candidates: string[];
  variables: readonly VariableSpec[];
  /** Row-major raw values aligned with variables order. */
  values: (number | null)[][];
  normalization: NormalizationId;
  mcdm: McdmId;
  weightScheme: WeightSchemeId;
  policy?: Partial<MissingDataPolicy>;
  manualWeights?: {
    factors: Record<string, number>;
    variablesWithin: Record<string, Record<string, number>>;
  };
};

export type ScoreBlockResult = {
  prepared: PreparedBlock;
  weights: HierarchicalWeights;
  normalized: number[][];
  scores: number[];
  ranking: { iso3: string; score: number; rank: number }[];
  /** Within-factor attractiveness (pre factor-weight), keyed by ISO3. */
  factorScores: Record<string, Record<string, number>>;
};

export function scoreBlock(input: ScoreBlockInput): ScoreBlockResult {
  const { kept: varsNoAlias, dropped: droppedAliases } = dropCoWeightedAliases(
    input.variables,
  );
  const aliasNotes =
    droppedAliases.length > 0
      ? [`Dropped co-weighted aliases (keep canonical): ${droppedAliases.join(", ")}`]
      : [];

  // Catalog transforms (e.g. log) before missing-data prep / normalisation.
  const transformed = applyCatalogTransforms(input.values, varsNoAlias);

  const columns = varsNoAlias.map((v) => v.id);
  const directions: Record<string, Direction> = {};
  for (const v of varsNoAlias) directions[v.id] = v.direction;

  const prepInput: PrepareBlockInput = {
    candidates: input.candidates,
    columns,
    values: transformed,
  };
  if (input.policy !== undefined) prepInput.policy = input.policy;
  const prepared = prepareBlock(prepInput);
  prepared.notes.push(...aliasNotes);
  const usedVars = varsNoAlias.filter((v) => prepared.usedVariables.includes(v.id));
  const usedDirs: Record<string, Direction> = {};
  for (const v of usedVars) usedDirs[v.id] = v.direction;

  const weightOpts: {
    matrix: number[][];
    columns: string[];
    directions: Record<string, Direction>;
    manual?: {
      factors: Record<string, number>;
      variablesWithin: Record<string, Record<string, number>>;
    };
  } = {
    matrix: prepared.matrix,
    columns: prepared.usedVariables,
    directions: usedDirs,
  };
  if (input.manualWeights !== undefined) {
    weightOpts.manual = input.manualWeights;
  }
  let weights = getWeights(input.weightScheme, usedVars, weightOpts);
  weights = restrictWeights(weights, prepared.usedVariables);

  const normalized = normalizeMatrix(
    prepared.matrix,
    prepared.usedVariables,
    usedDirs,
    input.normalization,
  );

  const scores = scoreMcdm(
    prepared.matrix,
    prepared.usedVariables,
    weights,
    usedDirs,
    input.mcdm,
    { normalized },
  );

  const contrib = factorContributions(normalized, prepared.usedVariables, weights);
  const factorScores: Record<string, Record<string, number>> = {};
  for (let i = 0; i < prepared.candidates.length; i++) {
    factorScores[prepared.candidates[i]!] = contrib.perCandidate[i]!;
  }

  const order = scores
    .map((score, i) => ({ iso3: prepared.candidates[i]!, score, i }))
    .sort((a, b) =>
      compareScoreDescending(a.score, b.score, a.iso3.localeCompare(b.iso3)),
    );

  const ranking = order.map((row, rank0) => ({
    iso3: row.iso3,
    score: row.score,
    rank: rank0 + 1,
  }));

  return { prepared, weights, normalized, scores, ranking, factorScores };
}
