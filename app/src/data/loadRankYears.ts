export type RankYearRow = { iso3: string; score: number; rank: number };

export type RankYearsFixture = {
  source: string;
  origin: string;
  hs: string;
  normalization: string;
  mcdm: string;
  weight_scheme: string;
  years: number[];
  focus_iso3: string[];
  rankings: Record<string, RankYearRow[]>;
};

let cache: RankYearsFixture | null = null;

export async function loadRankYearsFixture(): Promise<RankYearsFixture> {
  if (cache) return cache;
  const res = await fetch(`${import.meta.env.BASE_URL}meta/phase11_rank_years.json`);
  if (!res.ok) throw new Error(`Failed to load rank-years fixture (${res.status})`);
  cache = (await res.json()) as RankYearsFixture;
  return cache;
}
