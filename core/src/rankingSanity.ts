/**
 * Ranking sanity checks (B1): credible top markets, score spread, no tiny hubs.
 * Pure predicates so CI can assert without DuckDB when given a ranking snapshot.
 */

export type SanityRankRow = {
  iso3: string;
  score: number;
  rank: number;
  /** Population (people). Optional — microstate rule skipped when missing. */
  population?: number | null;
  /** Import volume of the destination for the HS (same units as peer). */
  importVolume?: number | null;
};

export type RankingSanityOpts = {
  /** ISO3 that must appear in top N (e.g. USA in top 5 for COL·64). */
  mustInTop?: { iso3: string; topN: number };
  /** At least one of these ISO3 in top N (e.g. DEU|FRA|ITA for ESP·0901). */
  anyInTop?: { iso3s: readonly string[]; topN: number };
  /** Minimum score gap between rank 1 and rank 10 (scores on ~0–10 scale). */
  minGap1to10?: number;
  /** Population below this is a microstate (default 1e6). */
  microstatePopMax?: number;
  /** Microstate in top 5 is OK only if its imports ≥ this share of #1. */
  microstateMinImportShareOfLeader?: number;
};

export type RankingSanityResult = {
  ok: boolean;
  failures: string[];
};

export function checkRankingSanity(
  ranking: readonly SanityRankRow[],
  opts: RankingSanityOpts,
): RankingSanityResult {
  const failures: string[] = [];
  const ordered = [...ranking].sort(
    (a, b) => a.rank - b.rank || b.score - a.score || a.iso3.localeCompare(b.iso3),
  );

  if (opts.mustInTop) {
    const { iso3, topN } = opts.mustInTop;
    const hit = ordered.slice(0, topN).some((r) => r.iso3 === iso3);
    if (!hit) failures.push(`${iso3} missing from top ${topN}`);
  }

  if (opts.anyInTop) {
    const { iso3s, topN } = opts.anyInTop;
    const top = new Set(ordered.slice(0, topN).map((r) => r.iso3));
    if (!iso3s.some((c) => top.has(c))) {
      failures.push(`none of [${iso3s.join(",")}] in top ${topN}`);
    }
  }

  if (opts.minGap1to10 !== undefined && ordered.length >= 10) {
    const s1 = ordered[0]!.score;
    const s10 = ordered[9]!.score;
    const gap = s1 - s10;
    if (!(gap >= opts.minGap1to10)) {
      failures.push(`gap 1→10 is ${gap}, need ≥ ${opts.minGap1to10}`);
    }
  }

  const popMax = opts.microstatePopMax ?? 1_000_000;
  const minShare = opts.microstateMinImportShareOfLeader ?? 0.01;
  const leader = ordered[0];
  const leaderImp = leader?.importVolume;
  if (leader && leaderImp != null && Number.isFinite(leaderImp) && leaderImp > 0) {
    for (const r of ordered.slice(0, 5)) {
      const pop = r.population;
      if (pop == null || !Number.isFinite(pop) || pop >= popMax) continue;
      const imp = r.importVolume;
      if (imp == null || !Number.isFinite(imp)) {
        failures.push(`microstate ${r.iso3} in top 5 without import volume`);
        continue;
      }
      if (imp / leaderImp < minShare) {
        failures.push(
          `microstate ${r.iso3} in top 5 with imports ${((imp / leaderImp) * 100).toFixed(2)}% of leader`,
        );
      }
    }
  }

  return { ok: failures.length === 0, failures };
}

/** COL · HS64 · 2024 expectations from PROMPT_CURSOR_SUPER B1. */
export const COL_HS64_SANITY: RankingSanityOpts = {
  mustInTop: { iso3: "USA", topN: 5 },
  minGap1to10: 1,
  microstatePopMax: 1_000_000,
  microstateMinImportShareOfLeader: 0.01,
};

/** ESP · HS0901 · 2024 expectations. */
export const ESP_0901_SANITY: RankingSanityOpts = {
  anyInTop: { iso3s: ["DEU", "FRA", "ITA"], topN: 10 },
  minGap1to10: 1,
  microstatePopMax: 1_000_000,
  microstateMinImportShareOfLeader: 0.01,
};
