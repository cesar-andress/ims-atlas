import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./rankingEngine", () => ({
  computeRanking: vi.fn(async () => ({
    ranking: [{ iso3: "AAA", score: 1, rank: 1 }],
    elapsedMs: 1,
    prepared: {
      candidates: ["AAA"],
      usedVariables: [],
      excludedVariables: [],
      nImputedCells: 0,
      imputedMask: [[false]],
      matrix: [[0]],
      nCandidates: 1,
      notes: [],
    },
    weights: { factors: {}, variablesWithin: {}, scheme: "equal", notes: [] },
    normalized: [[0]],
    scores: [1],
    factorScores: { AAA: {} },
    panel: {},
    warnings: [],
  })),
}));

describe("rankingCache", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { clearRankingCache } = await import("./rankingCache");
    clearRankingCache();
  });

  it("reuses the same result for identical requests", async () => {
    const { computeRanking } = await import("./rankingEngine");
    const { getCachedRanking, peekCachedRanking } = await import("./rankingCache");
    const req = {
      origin: "COL",
      hs: "64",
      year: 2023,
      weightScheme: "expert_mean" as const,
    };
    expect(peekCachedRanking(req)).toBeNull();
    const a = await getCachedRanking(req);
    expect(peekCachedRanking(req)).toBe(a);
    const b = await getCachedRanking(req);
    expect(a).toBe(b);
    expect(computeRanking).toHaveBeenCalledTimes(1);
  });
});
