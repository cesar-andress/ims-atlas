/**
 * Optional BACI trade volumes for pre-selection (Phase H / R2).
 * Filled from DuckDB-WASM when trade/hs2=…/part.parquet is reachable;
 * otherwise ranking falls back to the demo panel import proxy.
 */

export type BaciImportCache = {
  hs2: string;
  year: number;
  volumes: Record<string, number>;
  source: "baci_release" | "unavailable";
};

let cache: BaciImportCache | null = null;

export function setBaciImportCache(next: BaciImportCache | null): void {
  cache = next;
}

export function getBaciImportCache(): BaciImportCache | null {
  return cache;
}

export function baciVolumesFor(
  hs: string | undefined,
  year: number | undefined,
): Record<string, number> | null {
  if (!cache || cache.source !== "baci_release") return null;
  if (!hs || year === undefined) return null;
  // Release trade parts are HS2 chapter aggregates only — never reuse them for HS4/HS6.
  const digits = hs.replace(/\D/g, "");
  if (digits.length !== 2) return null;
  const hs2 = digits.padStart(2, "0");
  if (cache.hs2 !== hs2 || cache.year !== year) return null;
  return cache.volumes;
}
