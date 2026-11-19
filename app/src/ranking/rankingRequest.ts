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
  };
}
