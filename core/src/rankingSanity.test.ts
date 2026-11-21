import { describe, expect, it } from "vitest";
import {
  checkRankingSanity,
  COL_HS64_SANITY,
  ESP_0901_SANITY,
} from "./rankingSanity.js";

function rows(
  list: Array<{
    iso3: string;
    score: number;
    population?: number;
    importVolume?: number;
  }>,
) {
  return list.map((r, i) => ({
    iso3: r.iso3,
    score: r.score,
    rank: i + 1,
    population: r.population ?? 10_000_000,
    importVolume: r.importVolume ?? 1_000_000_000,
  }));
}

describe("checkRankingSanity", () => {
  it("passes a credible COL·64-like top 10", () => {
    const ranking = rows([
      { iso3: "USA", score: 9.2 },
      { iso3: "DEU", score: 8.1 },
      { iso3: "FRA", score: 7.5 },
      { iso3: "GBR", score: 7.0 },
      { iso3: "ITA", score: 6.8 },
      { iso3: "ESP", score: 6.2 },
      { iso3: "NLD", score: 5.9 },
      { iso3: "CAN", score: 5.5 },
      { iso3: "BEL", score: 5.1 },
      { iso3: "MEX", score: 4.8 },
    ]);
    const r = checkRankingSanity(ranking, COL_HS64_SANITY);
    expect(r.ok).toBe(true);
  });

  it("fails when USA is absent from top 5", () => {
    const ranking = rows([
      { iso3: "CHN", score: 9 },
      { iso3: "DEU", score: 8 },
      { iso3: "FRA", score: 7 },
      { iso3: "ITA", score: 6 },
      { iso3: "ESP", score: 5 },
      { iso3: "USA", score: 4 },
      { iso3: "GBR", score: 3.5 },
      { iso3: "NLD", score: 3 },
      { iso3: "BEL", score: 2.5 },
      { iso3: "MEX", score: 2 },
    ]);
    const r = checkRankingSanity(ranking, COL_HS64_SANITY);
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes("USA"))).toBe(true);
  });

  it("fails a microstate hub with tiny imports in top 5", () => {
    const ranking = rows([
      { iso3: "USA", score: 9, importVolume: 1e9 },
      {
        iso3: "LUX",
        score: 8.5,
        population: 600_000,
        importVolume: 1_000_000,
      },
      { iso3: "DEU", score: 8 },
      { iso3: "FRA", score: 7 },
      { iso3: "ITA", score: 6 },
      { iso3: "ESP", score: 5 },
      { iso3: "GBR", score: 4.5 },
      { iso3: "NLD", score: 4 },
      { iso3: "BEL", score: 3.5 },
      { iso3: "MEX", score: 3 },
    ]);
    const r = checkRankingSanity(ranking, COL_HS64_SANITY);
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes("LUX"))).toBe(true);
  });

  it("accepts ESP·0901 when a large EU market is in top 10", () => {
    const ranking = rows([
      { iso3: "USA", score: 9 },
      { iso3: "CHN", score: 8 },
      { iso3: "JPN", score: 7.5 },
      { iso3: "GBR", score: 7 },
      { iso3: "NLD", score: 6.5 },
      { iso3: "BEL", score: 6 },
      { iso3: "FRA", score: 5.5 },
      { iso3: "CAN", score: 5 },
      { iso3: "MEX", score: 4.5 },
      { iso3: "AUS", score: 4 },
    ]);
    expect(checkRankingSanity(ranking, ESP_0901_SANITY).ok).toBe(true);
  });
});
