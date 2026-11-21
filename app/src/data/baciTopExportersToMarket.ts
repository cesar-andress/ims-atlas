/**
 * Top exporters into a destination market (BACI HS2 trade chapter).
 * Used by Plan 4P «Producto» — never invents shares when the chapter is missing.
 */

import { getAtlasDataClient, type AtlasDataClient } from "./duckdbClient";
import { hs2Of } from "./hsProducts";

export type BaciExporterRow = { iso3: string; valueUsd: number; share: number };

export type BaciExportersToMarketResult = {
  hs2: string;
  year: number;
  importer: string;
  totalUsd: number;
  rows: BaciExporterRow[];
  source: "baci_release" | "unavailable";
};

function miss(
  hs2: string,
  year: number,
  importer: string,
): BaciExportersToMarketResult {
  return {
    hs2,
    year,
    importer,
    totalUsd: 0,
    rows: [],
    source: "unavailable",
  };
}

export async function loadBaciTopExportersToMarket(
  opts: {
    hs: string;
    year: number;
    importer: string;
    topN?: number;
  },
  client: AtlasDataClient = getAtlasDataClient(),
): Promise<BaciExportersToMarketResult> {
  const digits = opts.hs.replace(/\D/g, "");
  const hs2 = hs2Of(opts.hs).padStart(2, "0");
  const importer = opts.importer.toUpperCase();
  const topN = Math.max(1, Math.floor(opts.topN ?? 5));
  // HS2–HS6 projects use the HS2 trade chapter for competitor shares.
  if (digits.length < 2 || digits.length > 6 || !/^[A-Z]{3}$/.test(importer)) {
    return miss(hs2, opts.year, importer);
  }

  try {
    await client.init();
    const ok = await client.loadTradeChapter(hs2);
    if (!ok) return miss(hs2, opts.year, importer);

    const table = `trade_hs2_${hs2}`;
    const rows = await client.querySql(`
      SELECT
        CAST(exporter AS VARCHAR) AS iso3,
        SUM(CAST(value_usd AS DOUBLE)) AS value_usd
      FROM ${table}
      WHERE year = ${opts.year}
        AND CAST(importer AS VARCHAR) = '${importer}'
      GROUP BY 1
      ORDER BY value_usd DESC
      LIMIT ${topN * 3}
    `);

    const ranked: { iso3: string; valueUsd: number }[] = [];
    let total = 0;
    for (const r of rows) {
      const iso3 = String(r.iso3 ?? "").toUpperCase();
      const valueUsd = Number(r.value_usd ?? 0);
      if (!/^[A-Z]{3}$/.test(iso3) || !Number.isFinite(valueUsd) || valueUsd <= 0) {
        continue;
      }
      ranked.push({ iso3, valueUsd });
      total += valueUsd;
    }
    ranked.sort((a, b) => b.valueUsd - a.valueUsd || a.iso3.localeCompare(b.iso3));
    const top = ranked.slice(0, topN).map((r) => ({
      iso3: r.iso3,
      valueUsd: r.valueUsd,
      share: total > 0 ? r.valueUsd / total : 0,
    }));

    return {
      hs2,
      year: opts.year,
      importer,
      totalUsd: total,
      rows: top,
      source: top.length > 0 ? "baci_release" : "unavailable",
    };
  } catch {
    return miss(hs2, opts.year, importer);
  }
}
