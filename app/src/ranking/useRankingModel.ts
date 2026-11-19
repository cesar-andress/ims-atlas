import { useEffect, useState } from "react";
import { useAnalysis } from "../state/useAnalysis";
import { getCachedRanking } from "./rankingCache";
import type { RankingViewModel } from "./rankingEngine";

/** Shared ranking model for Ranking / Matrix / Market map views. */
export function useRankingModel(): {
  model: RankingViewModel | null;
  error: string | null;
} {
  const { config } = useAnalysis();
  const [model, setModel] = useState<RankingViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void getCachedRanking({
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
    })
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
  }, [
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
  ]);

  return { model, error };
}
