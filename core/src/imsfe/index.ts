export {
  preselectMarkets,
  type FilterEffect,
  type ImportRow,
  type PreselectMode,
  type PreselectionResult,
} from "./preselection.js";

export {
  IMSFE_EOC_QUADRANTS,
  buildImsfeEocMatrix,
  eocQuadrantOf,
  normalizeEocRatio,
  type ImsfeEocMatrixResult,
  type ImsfeEocPoint,
  type ImsfeEocQuadrant,
} from "./eocMatrix.js";

export {
  aggregatePairwiseGeometric,
  ahpFromPairwise,
  globalAhPWeights,
  type AhpResult,
} from "./ahp.js";

export {
  HOFSTEDE_DIMENSIONS,
  culturalDistance,
  type HofstedeScores,
} from "./culturalDistance.js";

export {
  aggregateExpertMeans,
  anonymizeExpertLabels,
  summarizeNumeric,
  validateUnitWeights,
  type ExpertResponse,
  type WeightStatsSummary,
} from "./expertSurvey.js";

export {
  IMSFE_2025_DIRECTION,
  IMSFE_2025_SOURCE_NOTES,
  IMSFE_2025_STRUCTURE,
  METHOD_FAMILIES,
  type MethodFamilyId,
  type MethodFamilySpec,
} from "./methodFamily.js";

export {
  CRITERIA_TREE_PRESETS,
  IMSFEM_2025_OLIVE,
  IMSFE_2025_FOOTWEAR,
  orderKeysByWeight,
  renormalizeWeights,
  scoreImsfeTree,
  swapVariableInCriterion,
  weightedSum,
  type CriteriaTree,
  type CriteriaTreePresetId,
  type ImsfeScoreResult,
  type RenormalizeResult,
} from "./criteriaTree.js";

export {
  oneAtATimeWinnerThresholds,
  type WinnerThreshold,
} from "./winnerSensitivity.js";

export {
  applyZeroPolicy,
  countRankChanges,
  culturalDistanceByKind,
  detectDuplicateNumericRows,
  detectNearBinaryScaled,
  eocPercent,
  messageFor,
  rankingTableConsistent,
  scaleCostWithPolicy,
  suggestIso3,
  warnAggregatedRespondents,
  warnDiscontinuedSeries,
  warnEocDefinition,
  warnImpNonPositive,
  warnOutOfPlausibleRange,
  warnSumOfSumsZeroDistance,
  warnWeightsRenormalised,
  type CulturalDistanceKind,
  type EocSeriesUnits,
  type Lang,
  type MethodWarning,
  type ZeroPolicy,
} from "./methodChecks.js";
