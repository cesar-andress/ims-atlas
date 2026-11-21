/**
 * Country × year presence within a published year window.
 * Years must come from release data — this module only diffs and formats.
 */

import { countryLabel } from "../design/formatLocale";
import { ISO3_EXPORTERS } from "./iso3Exporters";

export type YearWindow = { min: number; max: number };

export type YearGapReport = {
  window: YearWindow;
  present: number[];
  missing: number[];
};

/** Inclusive integer years from min..max that are present / missing. */
export function computeYearGaps(
  presentYears: readonly number[],
  window: YearWindow,
): YearGapReport {
  const min = Math.trunc(window.min);
  const max = Math.trunc(window.max);
  const presentSet = new Set(
    presentYears
      .map((y) => Math.trunc(y))
      .filter((y) => Number.isFinite(y) && y >= min && y <= max),
  );
  const present: number[] = [];
  const missing: number[] = [];
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    return { window: { min, max }, present, missing };
  }
  for (let y = min; y <= max; y += 1) {
    if (presentSet.has(y)) present.push(y);
    else missing.push(y);
  }
  return { window: { min, max }, present, missing };
}

/** Collapse consecutive years into "2012–2024" / "2015" segments. */
export function formatYearRanges(years: readonly number[]): string {
  if (!years.length) return "";
  const sorted = [...years].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0]!;
  let prev = start;
  for (let i = 1; i < sorted.length; i += 1) {
    const y = sorted[i]!;
    if (y === prev + 1) {
      prev = y;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}–${prev}`);
    start = y;
    prev = y;
  }
  parts.push(start === prev ? String(start) : `${start}–${prev}`);
  return parts.join(", ");
}

export type CountrySearchHit = { iso3: string; name: string };

/** Search exporters by ISO3 or localized country name (never invents codes). */
export function searchCountries(
  query: string,
  lang: "en" | "es",
  limit = 12,
): CountrySearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: CountrySearchHit[] = [];
  for (const iso3 of ISO3_EXPORTERS) {
    const name = countryLabel(iso3, lang);
    const hay = `${iso3} ${name}`.toLowerCase();
    if (!hay.includes(q) && !iso3.toLowerCase().startsWith(q)) continue;
    out.push({ iso3, name });
    if (out.length >= limit) break;
  }
  return out;
}
