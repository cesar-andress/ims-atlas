/**
 * Build HOP frames from SMAA ranks (ranks[alt][sample], 1 = best).
 * Subsamples evenly so the animation stays short.
 */
export function hopSamplesFromRanks(
  alternatives: readonly string[],
  ranks: readonly (readonly number[])[],
  maxFrames = 40,
): string[][] {
  const nAlt = alternatives.length;
  const nSamples = ranks[0]?.length ?? 0;
  if (nAlt === 0 || nSamples === 0) return [];
  const step = Math.max(1, Math.floor(nSamples / maxFrames));
  const out: string[][] = [];
  for (let s = 0; s < nSamples; s += step) {
    const indexed = alternatives.map((iso, i) => ({
      iso,
      r: ranks[i]?.[s] ?? nAlt,
    }));
    indexed.sort((a, b) => a.r - b.r || a.iso.localeCompare(b.iso));
    out.push(indexed.map((x) => x.iso));
  }
  return out;
}
