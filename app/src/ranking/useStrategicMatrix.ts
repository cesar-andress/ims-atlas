import { useMemo } from "react";
import {
  buildStrategicMatrix,
  type AxisMode,
  type StrategicMatrixResult,
} from "@ims-atlas/core";
import { useAnalysis } from "../state/useAnalysis";
import type { RankingViewModel } from "./rankingEngine";

/** Controller helper: attractiveness × fit matrix from the ranking model. */
export function useStrategicMatrix(
  model: RankingViewModel | null,
  cutoffOverride?: AxisMode,
): StrategicMatrixResult | null {
  const { config } = useAnalysis();
  const cutoff: AxisMode =
    cutoffOverride ?? (config.matrixCutoff === "fixed" ? "fixed" : "median");

  return useMemo(() => {
    if (!model) return null;
    return buildStrategicMatrix({
      ranking: model.ranking,
      factorScores: model.factorScores,
      cutoff,
      ...(cutoff === "fixed"
        ? {
            fixedAttractiveness: config.matrixCutA ?? 0.5,
            fixedFit: config.matrixCutF ?? 0.5,
          }
        : {}),
    });
  }, [model, cutoff, config.matrixCutA, config.matrixCutF]);
}
