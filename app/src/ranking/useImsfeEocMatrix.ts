import { useMemo } from "react";
import {
  buildImsfeEocMatrix,
  type AxisMode,
  type ImsfeEocMatrixResult,
} from "@ims-atlas/core";
import { useAnalysis } from "../state/useAnalysis";
import type { RankingViewModel } from "./rankingEngine";

/** IMSFE × EOC matrix; EOC raw from panel variable EOC when present. */
export function useImsfeEocMatrix(
  model: RankingViewModel | null,
): ImsfeEocMatrixResult | null {
  const { config } = useAnalysis();
  const cutoff: AxisMode = config.matrixCutoff === "fixed" ? "fixed" : "median";

  return useMemo(() => {
    if (!model) return null;
    const eocIdx = model.panel.variables.findIndex((v) => v.id === "EOC");
    if (eocIdx < 0) return null;

    const rows = model.ranking.flatMap((r) => {
      const candIdx = model.panel.candidates.indexOf(r.iso3);
      if (candIdx < 0) return [];
      const v = model.panel.values[candIdx]?.[eocIdx];
      if (typeof v !== "number" || !Number.isFinite(v)) return [];
      return [
        {
          iso3: r.iso3,
          imsfe: r.score,
          eocRaw: v,
          rank: r.rank,
        },
      ];
    });
    if (rows.length === 0) return null;

    return buildImsfeEocMatrix({
      rows,
      cutoff,
      ...(cutoff === "fixed"
        ? {
            fixedCutImsfe: config.matrixCutA ?? 0.5,
            fixedCutEoc: config.matrixCutF ?? 0.5,
          }
        : {}),
    });
  }, [model, cutoff, config.matrixCutA, config.matrixCutF]);
}
