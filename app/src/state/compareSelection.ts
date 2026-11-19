/** Pure compareA / compareB patch (merged by setConfig) for Ranking and Matrix. */
export function nextCompareSelection(
  compareA: string | undefined,
  compareB: string | undefined,
  iso3: string,
): { compareA: string; compareB?: undefined } | { compareB: string } {
  if (!compareA || compareA === iso3) {
    return { compareA: iso3 };
  }
  if (!compareB) {
    return { compareB: iso3 };
  }
  return { compareA: iso3, compareB: undefined };
}
