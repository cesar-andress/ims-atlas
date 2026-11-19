import { useCallback } from "react";
import { nextCompareSelection } from "./compareSelection";
import { useAnalysis } from "./useAnalysis";

/**
 * Shared Controller for Ranking / Matrix compareA–compareB selection.
 * First click sets A; second distinct ISO sets B; third resets to A.
 */
export function useCompareSelection() {
  const { config, setConfig } = useAnalysis();

  const selectIso = useCallback(
    (iso3: string) => {
      setConfig(nextCompareSelection(config.compareA, config.compareB, iso3));
    },
    [config.compareA, config.compareB, setConfig],
  );

  const isSelected = useCallback(
    (iso3: string) => iso3 === config.compareA || iso3 === config.compareB,
    [config.compareA, config.compareB],
  );

  return {
    compareA: config.compareA,
    compareB: config.compareB,
    selectIso,
    isSelected,
    setConfig,
  };
}
