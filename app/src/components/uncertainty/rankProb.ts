/** Build rankProb[0..K-1] from SMAA acceptability matrix (alt × rank). */
export function acceptabilityToRankProb(
  acceptabilityRow: number[],
  maxRank: number,
): number[] {
  const out = new Array(maxRank).fill(0);
  for (let r = 0; r < maxRank; r++) {
    out[r] = acceptabilityRow[r] ?? 0;
  }
  return out;
}
