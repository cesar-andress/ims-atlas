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
  normalizeLogMinmax,
  normalizeMatrix,
  normalizeMinmax,
  normalizeRank,
  normalizeRatioLegacy,
  normalizeZscore,
} from "./normalize.js";

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

export { kMeans2d, type KMeansResult } from "./cluster.js";

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
