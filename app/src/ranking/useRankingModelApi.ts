import { useContext } from "react";
import { RankingModelContext } from "./rankingModelBase";

/** Shared ranking model (must be under RankingModelProvider). */
export function useRankingModel() {
  const ctx = useContext(RankingModelContext);
  if (!ctx) {
    throw new Error("useRankingModel requires RankingModelProvider");
  }
  return ctx;
}
