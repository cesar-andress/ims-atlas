import type { MarketNode } from "@ims-atlas/core";

/**
 * Label each cluster by the 2–3 variables with the highest mean score among
 * its members (plain characterisation for the similarity map).
 */
export function clusterDescriptors(
  nodes: readonly MarketNode[],
  factorScores: Readonly<Record<string, Readonly<Record<string, number>>>>,
  factors: readonly string[],
  topN = 2,
): Record<number, string> {
  const byCluster = new Map<number, string[]>();
  for (const n of nodes) {
    const list = byCluster.get(n.cluster) ?? [];
    list.push(n.iso3);
    byCluster.set(n.cluster, list);
  }
  const out: Record<number, string> = {};
  for (const [cluster, members] of byCluster) {
    if (factors.length === 0 || members.length === 0) {
      out[cluster] = `C${cluster}`;
      continue;
    }
    const means = factors.map((f) => {
      let s = 0;
      let n = 0;
      for (const iso of members) {
        const v = factorScores[iso]?.[f];
        if (typeof v === "number" && Number.isFinite(v)) {
          s += v;
          n += 1;
        }
      }
      return { f, mean: n ? s / n : 0 };
    });
    means.sort((a, b) => b.mean - a.mean || a.f.localeCompare(b.f));
    const parts = means.slice(0, topN).map((m) => m.f);
    out[cluster] = parts.length ? parts.join(" · ") : `C${cluster}`;
  }
  return out;
}
