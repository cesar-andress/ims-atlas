import { createContext } from "react";
import type { AnalysisModelError } from "./analysisError";
import type { RankingViewModel } from "./rankingEngine";

export type RankingModelValue = {
  model: RankingViewModel | null;
  error: AnalysisModelError | null;
  loading: boolean;
};

export const RankingModelContext = createContext<RankingModelValue | null>(null);
