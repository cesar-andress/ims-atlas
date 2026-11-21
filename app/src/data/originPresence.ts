/**
 * Origin presence (share of destination imports) and prior experience
 * (years with positive origin→destination sales) from BACI trade chapters.
 */

import { getAtlasDataClient, type AtlasDataClient } from "./duckdbClient";
import { hs2Of } from "./hsProducts";

export type OriginPresenceRow = {
  iso3: string;
  /** Origin's share of destination's HS imports in `year` (0..1). */
  originShare: number | null;
  /** Distinct years ≤ year with positive origin→dest trade (within lookback). */
  priorYears: number;
};

export type OriginPresenceResult = {
  hs2: string;
  year: number;
  origin: string;
  lookbackYears: number;
  byIso: Record<string, OriginPresenceRow>;
  source: "baci_release" | "unavailable";
};

function emptyResult(
  hs2: string,
  year: number,
  origin: string,
  lookbackYears: number,
): OriginPresenceResult {
  return {
    hs2,
    year,
    origin,
    lookbackYears,
    byIso: {},
    source: "unavailable",
  };
}

/**
 * Batch-load origin share (analysis year) and prior-experience year counts
 * for the given importers.
 */
export async function loadOriginPresence(
  opts: {
    hs: string;
    year: number;
    origin: string;
    importers: readonly string[];
    lookbackYears?: number;
  },
  client: AtlasDataClient = getAtlasDataClient(),
): Promise<OriginPresenceResult> {
  const digits = opts.hs.replace(/\D/g, "");
  const hs2 = hs2Of(opts.hs).padStart(2, "0");
  const origin = opts.origin.toUpperCase();
  const lookback = Math.max(1, Math.floor(opts.lookbackYears ?? 10));
  const yearMin = opts.year - lookback + 1;
  const importers = [
    ...new Set(
      opts.importers
        .map((x) => x.toUpperCase())
        .filter((x) => /^[A-Z]{3}$/.test(x) && x !== origin),
    ),
  ].sort();

  if (
    digits.length < 2 ||
    digits.length > 6 ||
    !/^[A-Z]{3}$/.test(origin) ||
    importers.length === 0
  ) {
    return emptyResult(hs2, opts.year, origin, lookback);
  }

  try {
    await client.init();
    const ok = await client.loadTradeChapter(hs2);
    if (!ok) return emptyResult(hs2, opts.year, origin, lookback);

    const table = `trade_hs2_${hs2}`;
    const inList = importers.map((i) => `'${i}'`).join(", ");

    const [shareRows, yearRows] = await Promise.all([
      client.querySql(`
        SELECT
          CAST(importer AS VARCHAR) AS iso3,
          SUM(
            CASE
              WHEN CAST(exporter AS VARCHAR) = '${origin}'
              THEN CAST(value_usd AS DOUBLE)
              ELSE 0
            END
          ) AS origin_usd,
          SUM(CAST(value_usd AS DOUBLE)) AS total_usd
        FROM ${table}
        WHERE year = ${opts.year}
          AND CAST(importer AS VARCHAR) IN (${inList})
        GROUP BY 1
      `),
      client.querySql(`
        SELECT
          CAST(importer AS VARCHAR) AS iso3,
          COUNT(DISTINCT year) AS years
        FROM ${table}
        WHERE CAST(exporter AS VARCHAR) = '${origin}'
          AND year >= ${yearMin}
          AND year <= ${opts.year}
          AND CAST(value_usd AS DOUBLE) > 0
          AND CAST(importer AS VARCHAR) IN (${inList})
        GROUP BY 1
      `),
    ]);

    const byIso: Record<string, OriginPresenceRow> = {};
    for (const iso of importers) {
      byIso[iso] = { iso3: iso, originShare: null, priorYears: 0 };
    }
    for (const r of shareRows) {
      const iso = String(r.iso3 ?? "").toUpperCase();
      if (!byIso[iso]) continue;
      const originUsd = Number(r.origin_usd ?? 0);
      const totalUsd = Number(r.total_usd ?? 0);
      if (Number.isFinite(totalUsd) && totalUsd > 0 && Number.isFinite(originUsd)) {
        byIso[iso]!.originShare = Math.max(0, Math.min(1, originUsd / totalUsd));
      }
    }
    for (const r of yearRows) {
      const iso = String(r.iso3 ?? "").toUpperCase();
      if (!byIso[iso]) continue;
      const years = Number(r.years ?? 0);
      if (Number.isFinite(years) && years > 0) {
        byIso[iso]!.priorYears = Math.floor(years);
      }
    }

    return {
      hs2,
      year: opts.year,
      origin,
      lookbackYears: lookback,
      byIso,
      source: "baci_release",
    };
  } catch {
    return emptyResult(hs2, opts.year, origin, lookback);
  }
}
