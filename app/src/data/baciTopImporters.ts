import { createDuckDbClient } from "./duckdbClient";
import { hs2Of } from "./hsProducts";
import { setBaciImportCache, type BaciImportCache } from "./baciImportCache";

export type BaciTopImportersResult = BaciImportCache & {
  top: { iso3: string; imports: number }[];
};

/**
 * Load HS2 trade parquet and aggregate importer totals for `year`.
 * On failure (no release / no chapter), marks cache unavailable and returns null rows.
 */
export async function loadBaciTopImporters(opts: {
  hs: string;
  year: number;
  topN?: number;
}): Promise<BaciTopImportersResult> {
  const digits = opts.hs.replace(/\D/g, "");
  const hs2 = hs2Of(opts.hs).padStart(2, "0");
  const topN = Math.max(1, Math.floor(opts.topN ?? 30));
  // Published trade parquet is HS2-only; refuse silent HS4/HS6 → HS2 collapse.
  if (digits.length !== 2) {
    const miss: BaciTopImportersResult = {
      hs2,
      year: opts.year,
      volumes: {},
      source: "unavailable",
      top: [],
    };
    setBaciImportCache(miss);
    return miss;
  }
  const client = createDuckDbClient();
  try {
    await client.init();
    const ok = await client.loadTradeChapter(hs2);
    if (!ok) {
      const miss: BaciTopImportersResult = {
        hs2,
        year: opts.year,
        volumes: {},
        source: "unavailable",
        top: [],
      };
      setBaciImportCache(miss);
      return miss;
    }
    const table = `trade_hs2_${hs2}`;
    // Schema may vary; try common BACI-derived columns used in release builders.
    const rows = await client.querySql(`
      SELECT
        CAST(importer AS VARCHAR) AS iso3,
        SUM(CAST(value_usd AS DOUBLE)) AS imports
      FROM ${table}
      WHERE year = ${opts.year}
      GROUP BY 1
      ORDER BY imports DESC
      LIMIT ${topN * 4}
    `);
    const volumes: Record<string, number> = {};
    const ranked: { iso3: string; imports: number }[] = [];
    for (const r of rows) {
      const iso3 = String(r.iso3 ?? "").toUpperCase();
      const imports = Number(r.imports ?? 0);
      if (!/^[A-Z]{3}$/.test(iso3) || !Number.isFinite(imports) || imports <= 0) {
        continue;
      }
      volumes[iso3] = imports;
      ranked.push({ iso3, imports });
    }
    ranked.sort((a, b) => b.imports - a.imports || a.iso3.localeCompare(b.iso3));
    const top = ranked.slice(0, topN);
    const hit: BaciTopImportersResult = {
      hs2,
      year: opts.year,
      volumes,
      source: Object.keys(volumes).length > 0 ? "baci_release" : "unavailable",
      top,
    };
    setBaciImportCache(hit);
    return hit;
  } catch {
    const miss: BaciTopImportersResult = {
      hs2,
      year: opts.year,
      volumes: {},
      source: "unavailable",
      top: [],
    };
    setBaciImportCache(miss);
    return miss;
  }
}
