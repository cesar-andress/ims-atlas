export type T4MetricRow = {
  method: string;
  metric: string;
  mean: number;
  ci95_low: number;
  ci95_high: number;
  n_blocks: number;
  target: string;
  horizon: number;
};

export type T4LiftRow = {
  method: string;
  baseline: string;
  metric: string;
  target: string;
  horizon: number;
  delta_mean: number;
  ci95_low: number;
  ci95_high: number;
  n_blocks: number;
};

export type T4AblationRow = {
  contrast: string;
  metric: string;
  delta_mean: number;
  ci95_low: number;
  ci95_high: number;
  n_blocks: number;
};

export type T4Fixture = {
  source: string;
  provenance: string;
  tolerance: { mean_abs: number; note: string };
  focal_method: string;
  metrics: T4MetricRow[];
  paired_lift: T4LiftRow[];
  ablation: T4AblationRow[];
  ablation_levels: {
    method: string;
    metric: string;
    mean: number;
    ci95_low: number;
    ci95_high: number;
    n_blocks: number;
  }[];
  col_hs64: {
    sweep: string;
    origin: string;
    hs_chapter: string;
    horizon_k: number;
    mean_ndcg_at_10: number;
    n_blocks: number;
    status: string;
  }[];
};

let cache: T4Fixture | null = null;

export async function loadT4Fixture(): Promise<T4Fixture> {
  if (cache) return cache;
  const res = await fetch(`${import.meta.env.BASE_URL}meta/phase10_t4.json`);
  if (!res.ok) throw new Error(`Failed to load T4 fixture (${res.status})`);
  cache = (await res.json()) as T4Fixture;
  return cache;
}
