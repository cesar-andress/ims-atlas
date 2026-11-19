import { useEffect, useMemo, useState } from "react";
import {
  pTopK,
  tornadoWeightSensitivity,
  weightStatsFromHierarchical,
  type SmaaResult,
  type TornadoBar,
} from "@ims-atlas/core";
import { useAnalysis } from "../state/useAnalysis";
import { runSmaaWorker } from "../workers/runWorker";
import type { RankingViewModel } from "./rankingEngine";

const DEFAULT_SAMPLES = 2_000;

export type SmaaViewModel = {
  smaa: SmaaResult;
  pTop1: number[];
  pTop5: number[];
  pTop10: number[];
  tornado: TornadoBar[];
  nSamples: number;
};

export function useSmaaModel(model: RankingViewModel | null): {
  smaaModel: SmaaViewModel | null;
  error: string | null;
  loading: boolean;
} {
  const { config } = useAnalysis();
  const seed = config.mapSeed ?? 42;
  const nSamples = DEFAULT_SAMPLES;
  const [smaaModel, setSmaaModel] = useState<SmaaViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fingerprint = useMemo(() => {
    if (!model) return null;
    return JSON.stringify({
      n: model.prepared.candidates.length,
      cols: model.prepared.usedVariables,
      seed,
      nSamples,
      scheme: model.weights.scheme,
      topScore: model.ranking[0]?.score,
    });
  }, [model, seed, nSamples]);

  useEffect(() => {
    if (!model || !fingerprint) {
      setSmaaModel(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const stats = weightStatsFromHierarchical(model.weights);
    const tornado = tornadoWeightSensitivity(
      model.normalized,
      model.prepared.usedVariables,
      model.weights,
      { scale: 0.5, includeVariables: false },
    );
    void runSmaaWorker({
      type: "smaa_wsm",
      id: `smaa-${fingerprint.slice(0, 24)}`,
      normalized: model.normalized,
      alternatives: model.prepared.candidates,
      columns: model.prepared.usedVariables,
      stats,
      nSamples,
      seed,
      mode: "dirichlet",
      dispersionScale: 1,
    })
      .then((smaa) => {
        if (cancelled) return;
        setSmaaModel({
          smaa,
          pTop1: pTopK(smaa.ranks, 1),
          pTop5: pTopK(smaa.ranks, 5),
          pTop10: pTopK(smaa.ranks, 10),
          tornado,
          nSamples,
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSmaaModel(null);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [model, fingerprint, seed, nSamples]);

  return { smaaModel, error, loading };
}
