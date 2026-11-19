/**
 * Cultural disaffinity as in the IMSFE papers: sum of |origin − destination|
 * over the six Hofstede dimensions (BYOD; not redistributable).
 */

export const HOFSTEDE_DIMENSIONS = [
  "power_distance",
  "individualism",
  "motivation_achievement",
  "uncertainty_avoidance",
  "long_term_orientation",
  "indulgence",
] as const;

export type HofstedeScores = Record<(typeof HOFSTEDE_DIMENSIONS)[number], number>;

export function culturalDistance(
  origin: HofstedeScores,
  destination: HofstedeScores,
): number {
  let sum = 0;
  for (const dim of HOFSTEDE_DIMENSIONS) {
    const a = origin[dim];
    const b = destination[dim];
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return Number.NaN;
    }
    sum += Math.abs(a - b);
  }
  return sum;
}
