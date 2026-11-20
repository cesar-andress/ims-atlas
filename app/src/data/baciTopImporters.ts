import {
  getAtlasDataClient,
  type AtlasDataClient,
} from "./duckdbClient";
import { hs2Of } from "./hsProducts";
import {
  getBaciImportCache,
  setBaciImportCache,
  type BaciImportCache,
} from "./baciImportCache";

export type BaciTopImportersResult = BaciImportCache & {
  top: { iso3: string; imports: number }[];
};

function missResult(hs2: string, year: number): BaciTopImportersResult {
  const miss: BaciTopImportersResult = {
    hs2,
    year,
    volumes: {},
    source: "unavailable",
    top: [],
  };
  setBaciImportCache(miss);
  return miss;
}

function hitFromCache(
  cache: BaciImportCache,
  topN: number,
): BaciTopImportersResult | null {
  if (cache.source !== "baci_release") return null;
  const ranked = Object.entries(cache.volumes)
    .map(([iso3, imports]) => ({ iso3, imports }))
    .filter((r) => Number.isFinite(r.imports) && r.imports > 0)
    .sort((a, b) => b.imports - a.imports || a.iso3.localeCompare(b.iso3));
  return {
    ...cache,
    top: ranked.slice(0, topN),
  };
}

/**
 * Load HS2 trade parquet and aggregate importer totals for `year`.
 * On failure (no release / no chapter), marks cache unavailable and returns null rows.
 *
 * Uses the shared DuckDB client and aggregates directly against `read_parquet`
 * with a year filter (no full-chapter TABLE materialisation).
 */
export async function loadBaciTopImporters(
  opts: {
    hs: string;
    year: number;
    topN?: number;
  },
  client: AtlasDataClient = getAtlasDataClient(),
): Promise<BaciTopImportersResult> {
  const digits = opts.hs.replace(/\D/g, "");
  const hs2 = hs2Of(opts.hs).padStart(2, "0");
  const topN = Math.max(1, Math.floor(opts.topN ?? 30));
  // Published trade parquet is HS2-only; refuse silent HS4/HS6 → HS2 collapse.
  if (digits.length !== 2) {
    return missResult(hs2, opts.year);
  }

  const cached = getBaciImportCache();
  if (
    cached &&
    cached.hs2 === hs2 &&
    cached.year === opts.year &&
    cached.source === "baci_release"
  ) {
    const hit = hitFromCache(cached, topN);
    if (hit) return hit;
  }

  try {
    await client.init();
    const ok = await client.loadTradeChapter(hs2);
    if (!ok) return missResult(hs2, opts.year);

    const url = client.tradeChapterUrl(hs2);
    const table = `trade_hs2_${hs2}`;
    // Prefer direct parquet path (year pushdown); fall back to registered VIEW.
    const fromClause = url
      ? `read_parquet('${url.replace(/'/g, "''")}')`
      : table;
    const rows = await client.querySql(`
      SELECT
        CAST(importer AS VARCHAR) AS iso3,
        SUM(CAST(value_usd AS DOUBLE)) AS imports
      FROM ${fromClause}
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
    return missResult(hs2, opts.year);
  }
}
