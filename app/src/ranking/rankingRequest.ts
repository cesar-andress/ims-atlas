import type { RankingRequest } from "./rankingEngine";

/** Stable request fingerprint (avoids recompute when URL re-parses equal arrays). */
export function rankingRequestKey(req: RankingRequest): string {
  return JSON.stringify({
    origin: req.origin ?? null,
    hs: req.hs ?? null,
    year: req.year ?? null,
    region: req.region ?? null,
    minImports: req.minImports ?? null,
    variableIds: req.variableIds ?? null,
    normalization: req.normalization ?? null,
    mcdm: req.mcdm ?? null,
    weightScheme: req.weightScheme ?? null,
    missingThreshold: req.missingThreshold ?? null,
    factorWeights: req.factorWeights ?? null,
    methodFamily: req.methodFamily ?? null,
    zeroPolicy: req.zeroPolicy ?? null,
    zeroEpsilon: req.zeroEpsilon ?? null,
    zeroOffsetC: req.zeroOffsetC ?? null,
    culturalDistanceKind: req.culturalDistanceKind ?? null,
    imputationMethod: req.imputationMethod ?? null,
    combinedEocWeight: req.combinedEocWeight ?? null,
    combinedEocNorm: req.combinedEocNorm ?? null,
    preselectPick: req.preselectPick ?? null,
    includeOriginInPreselect: req.includeOriginInPreselect ?? null,
    preselectMode: req.preselectMode ?? null,
    preselectTopN: req.preselectTopN ?? null,
    preselectCumShare: req.preselectCumShare ?? null,
  });
}

export function rankingRequestFromConfig(config: {
  origin?: string | undefined;
  hs?: string | undefined;
  year?: number | undefined;
  region?: string | undefined;
  minImports?: number | undefined;
  variableIds?: string[] | undefined;
  normalization?: RankingRequest["normalization"];
  mcdm?: RankingRequest["mcdm"];
  weightScheme?: RankingRequest["weightScheme"];
  missingThreshold?: number | undefined;
  factorWeights?: Record<string, number> | undefined;
  methodFamily?: RankingRequest["methodFamily"];
  zeroPolicy?: RankingRequest["zeroPolicy"];
  zeroEpsilon?: number | undefined;
  zeroOffsetC?: number | undefined;
  culturalDistanceKind?: RankingRequest["culturalDistanceKind"];
  imputationMethod?: RankingRequest["imputationMethod"];
  combinedEocWeight?: number | undefined;
  combinedEocNorm?: RankingRequest["combinedEocNorm"];
  preselectPick?: RankingRequest["preselectPick"];
  includeOriginInPreselect?: boolean | undefined;
  preselectMode?: RankingRequest["preselectMode"];
  preselectTopN?: number | undefined;
  preselectCumShare?: number | undefined;
}): RankingRequest {
  return {
    origin: config.origin,
    hs: config.hs,
    year: config.year,
    region: config.region,
    minImports: config.minImports,
    variableIds: config.variableIds,
    normalization: config.normalization,
    mcdm: config.mcdm,
    weightScheme: config.weightScheme,
    missingThreshold: config.missingThreshold,
    factorWeights: config.factorWeights,
    methodFamily: config.methodFamily,
    zeroPolicy: config.zeroPolicy,
    zeroEpsilon: config.zeroEpsilon,
    zeroOffsetC: config.zeroOffsetC,
    culturalDistanceKind: config.culturalDistanceKind,
    imputationMethod: config.imputationMethod,
    combinedEocWeight: config.combinedEocWeight,
    combinedEocNorm: config.combinedEocNorm,
    preselectPick: config.preselectPick,
    includeOriginInPreselect: config.includeOriginInPreselect,
    preselectMode: config.preselectMode,
    preselectTopN: config.preselectTopN,
    preselectCumShare: config.preselectCumShare,
  };
}
