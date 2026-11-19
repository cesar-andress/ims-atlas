import type { ReactNode } from "react";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisView } from "../state/views";
import { RankingModelContext } from "./rankingModelBase";
import { useRankingModelState } from "./useRankingModel";

/**
 * One ranking subscription for the whole analysis workspace.
 * Route switches (Ranking → Matrix → Map) reuse the same model without remount cost.
 */
export function RankingModelProvider({ children }: { children: ReactNode }) {
  const { config } = useAnalysis();
  const enabled = isAnalysisView(config.view);
  const value = useRankingModelState(enabled);
  return (
    <RankingModelContext.Provider value={value}>
      {children}
    </RankingModelContext.Provider>
  );
}
