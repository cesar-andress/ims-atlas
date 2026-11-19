import { useContext } from "react";
import { AnalysisContext } from "./analysisContextBase";

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis requires AnalysisProvider");
  return ctx;
}
