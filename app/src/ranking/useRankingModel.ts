import { useEffect, useMemo, useRef, useState } from "react";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisReady } from "../state/views";
import { getCachedRanking } from "./rankingCache";
import type { RankingRequest, RankingViewModel } from "./rankingEngine";

/** Stable request fingerprint (avoids recompute when URL re-parses equal arrays). */
function rankingRequestKey(req: RankingRequest): string {
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

/** Shared ranking model for Ranking / Matrix / Market map views. */
export function useRankingModel(): {
  model: RankingViewModel | null;
  error: string | null;
} {
  const { config } = useAnalysis();
  const [model, setModel] = useState<RankingViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = isAnalysisReady(config);

  const request = useMemo<RankingRequest>(
    () => ({
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
    }),
    [
      config.origin,
      config.hs,
      config.year,
      config.region,
      config.minImports,
      config.variableIds,
      config.normalization,
      config.mcdm,
      config.weightScheme,
      config.missingThreshold,
      config.factorWeights,
    ],
  );

  const requestKey = rankingRequestKey(request);
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    if (!ready) {
      setModel(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    void getCachedRanking(requestRef.current)
      .then((m) => {
        if (!cancelled) setModel(m);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setModel(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, requestKey]);

  return { model, error };
}
