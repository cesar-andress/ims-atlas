import { useEffect, useMemo, useRef, useState } from "react";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisReady } from "../state/views";
import { analysisErrorFromUnknown, type AnalysisModelError } from "./analysisError";
import { getCachedRanking, peekCachedRanking } from "./rankingCache";
import type { RankingViewModel } from "./rankingEngine";
import { rankingRequestFromConfig, rankingRequestKey } from "./rankingRequest";

export { rankingRequestFromConfig, rankingRequestKey } from "./rankingRequest";

/**
 * Ranking model state. Prefer RankingModelProvider so analysis route switches
 * reuse one subscription instead of remounting N hooks.
 */
export function useRankingModelState(enabled = true): {
  model: RankingViewModel | null;
  error: AnalysisModelError | null;
  loading: boolean;
} {
  const { config } = useAnalysis();
  const ready = isAnalysisReady(config) && enabled;

  const request = useMemo(
    () => rankingRequestFromConfig(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primitive ranking inputs only
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

  const [model, setModel] = useState<RankingViewModel | null>(() =>
    ready ? peekCachedRanking(request) : null,
  );
  const [error, setError] = useState<AnalysisModelError | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) {
      setModel(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const req = requestRef.current;
    const peeked = peekCachedRanking(req);
    if (peeked) {
      setModel(peeked);
      setError(null);
      setLoading(false);
      return;
    }
    // Stale-while-revalidate: keep previous model visible while recomputing.
    setLoading(true);
    setError(null);
    void getCachedRanking(req)
      .then((m) => {
        if (!cancelled) {
          setModel(m);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setModel(null);
          setError(analysisErrorFromUnknown(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, requestKey]);

  return { model, error, loading };
}
