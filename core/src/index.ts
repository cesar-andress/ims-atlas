/** Package version — kept in sync with package.json for runtime checks. */
export const version = "1.1.0";

export {
  evidencePresent,
  gate,
  gateOne,
  type Deployment,
  type GateDecision,
  type GateResult,
  type GateVariable,
  type RightsEvidence,
  type SourceRights,
  type YesNoUnknown,
} from "./gate.js";

export { taint, type StoreKind } from "./access.js";

export type {
  Direction,
  FactorId,
  HierarchicalWeights,
  McdmId,
  MissingDataPolicy,
  NormalizationId,
  PreparedBlock,
  VariableSpec,
  WeightSchemeId,
} from "./types.js";

export {
  normalizeColumn,
  normalizeDmp,
  normalizeImp,
  normalizeLogMinmax,
  normalizeMatrix,
  normalizeMinmax,
  normalizeRank,
  normalizeRatioLegacy,
  normalizeRobustZ,
  normalizeZscore,
} from "./normalize.js";

export {
  applyDirectionAfterScale,
  applySkewTransform,
  describeReferenceSet,
  runColumnPipeline,
  scaleBenefit,
  winsorize,
  type ColumnPipelineConfig,
  type ColumnPipelineResult,
  type OutlierTreatment,
  type ReferenceSet,
  type ScaleMethod,
  type SkewTransform,
  type YearPooling,
} from "./transformPipeline.js";

export {
  correlationMatrix,
  highCorrelationWarnings,
  whitenMatrix,
  type CorrelationWarning,
} from "./correlation.js";

export {
  compareRankings,
  topBottom,
  type NormCompareResult,
  type RankRow,
} from "./labCompare.js";

export {
  CRITERIA_TREE_PRESETS,
  IMSFEM_2025_OLIVE,
  IMSFE_2025_DIRECTION,
  IMSFE_2025_FOOTWEAR,
  IMSFE_2025_SOURCE_NOTES,
  IMSFE_2025_STRUCTURE,
  IMSFE_EOC_QUADRANTS,
  METHOD_FAMILIES,
  aggregateExpertMeans,
  aggregatePairwiseGeometric,
  ahpFromPairwise,
  anonymizeExpertLabels,
  buildImsfeEocMatrix,
  culturalDistance,
  eocQuadrantOf,
  globalAhPWeights,
  normalizeEocRatio,
  oneAtATimeWinnerThresholds,
  orderKeysByWeight,
  preselectMarkets,
  renormalizeWeights,
  scoreImsfeTree,
  summarizeNumeric,
  swapVariableInCriterion,
  validateUnitWeights,
  weightedSum,
  type AhpResult,
  type CriteriaTree,
  type CriteriaTreePresetId,
  type ExpertResponse,
  type FilterEffect,
  type HofstedeScores,
  type ImsfeEocMatrixResult,
  type ImsfeEocPoint,
  type ImsfeEocQuadrant,
  type ImsfeScoreResult,
  type ImportRow,
  type MethodFamilyId,
  type MethodFamilySpec,
  type PreselectMode,
  type PreselectionResult,
  type RenormalizeResult,
  type WeightStatsSummary,
  type WinnerThreshold,
} from "./imsfe/index.js";

export {
  DEFAULT_MISSING_POLICY,
  InsufficientCandidatesError,
  prepareBlock,
  type PrepareBlockInput,
} from "./missing.js";

export {
  flatToHierarchical,
  flatWeights,
  getWeights,
  restrictWeights,
  validateWeights,
  weightsCriticFlat,
  weightsEntropyFlat,
  weightsEqual,
  weightsExpertMean,
  weightsManual,
} from "./weights.js";

export {
  factorContributions,
  hierarchicalWsm,
  score,
  scorePrometheeIi,
  scoreTopsis,
  scoreVikor,
} from "./mcdm.js";

export { scoreBlock, type ScoreBlockInput, type ScoreBlockResult } from "./score.js";

export {
  EXPERT_FACTOR_MEANS,
  EXPERT_VARIABLE_MEANS,
  LEGACY_FACTOR_MAP,
} from "./presets/imsfeExpert2025.js";

export {
  createRng,
  randomDirichlet,
  randomGamma,
  randomNormal,
  type Rng,
} from "./rng.js";

export {
  deterministicWsmScores,
  dirichletConcentration,
  pTopK,
  rankAcceptability,
  ranksFromScores,
  runSmaaWsm,
  sampleBox,
  sampleDirichlet,
  sampleHierarchicalWeights,
  type SamplingMode,
  type SmaaResult,
  type WeightStats,
} from "./smaa.js";

export {
  aucExt,
  evaluateRanking,
  ndcgAtK,
  precisionAtK,
  relevanceGains,
  spearmanCorr,
  type GainMode,
} from "./metrics.js";

export { baselineScores, type BaselineName } from "./baselines.js";

export {
  evaluateBacktestBlock,
  makeWalkForwardSplit,
  type BacktestBlock,
  type BlockMetricRow,
  type TargetName,
  type WalkForwardSplit,
} from "./backtest.js";

export {
  bootstrapMethodSummary,
  bootstrapPairedDeltas,
  type BootstrapSummary,
  type PairedDelta,
} from "./bootstrap.js";

export {
  handleWorkerRequest,
  type WorkerRequest,
  type WorkerResponse,
} from "./workerProtocol.js";

export { tornadoWeightSensitivity, type TornadoBar } from "./sensitivity.js";

export { weightStatsFromHierarchical } from "./weightStats.js";

export {
  centerAndOrient,
  classicalMds2d,
  kruskalStress,
  layoutFromProfiles,
  pairwiseDistances,
  smacof2d,
  type Point2,
  type SmacofOptions,
  type SmacofResult,
} from "./mds.js";

export { kMeans2d, silhouette2d, type KMeansResult } from "./cluster.js";

export {
  buildMarketLayout,
  buildSimilarityEdges,
  type MarketEdge,
  type MarketLayoutResult,
  type MarketNode,
} from "./marketLayout.js";

export {
  IMSFE_ATTRACTIVENESS_FACTORS,
  IMSFE_FIT_FACTORS,
  buildStrategicMatrix,
  quadrantOf,
  type AxisMode,
  type StrategicMatrixResult,
  type StrategicPoint,
} from "./strategic.js";
