/** Display helper for index scores (full precision stays in data attributes). */
export function formatScore(score: number, digits = 4): string {
  return score.toFixed(digits);
}
