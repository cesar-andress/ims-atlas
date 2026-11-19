/**
 * Phase 8: COL HS64 2023 expert ranking must match imsfe golden @ 1e-9.
 * Re-ranking 60 destinations must finish under 100 ms.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scoreBlock } from "./score.js";
import type { Direction, VariableSpec } from "./types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const goldenPath = join(root, "fixtures/phase8/synthetic_col_hs64.json");

type Golden = {
  tolerance: number;
  block: {
    candidates: string[];
    variables: { id: string; factor: string; direction: Direction }[];
    raw: Record<string, number | null | string>[];
    ranking_expert: { iso3: string; score: number; rank: number }[];
    weights_expert: {
      factors: Record<string, number>;
      variables_within: Record<string, Record<string, number>>;
    };
    factor_scores: Record<string, Record<string, number>>;
    missing_threshold: number;
  };
};

function loadGolden(): Golden {
  return JSON.parse(readFileSync(goldenPath, "utf8")) as Golden;
}

describe("phase8 COL HS64 golden", () => {
  it("matches imsfe expert WSM ranking @ 1e-9", () => {
    const golden = loadGolden();
    const block = golden.block;
    const variables: VariableSpec[] = block.variables.map((v) => ({
      id: v.id,
      factor: v.factor,
      direction: v.direction,
    }));
    const columns = variables.map((v) => v.id);
    const values = block.raw.map((row) =>
      columns.map((id) => {
        const v = row[id];
        return typeof v === "number" ? v : null;
      }),
    );

    const result = scoreBlock({
      candidates: block.candidates,
      variables,
      values,
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "expert_mean",
      policy: { maxMissingShare: block.missing_threshold, minCandidates: 20 },
    });

    expect(result.ranking.length).toBe(60);
    for (let i = 0; i < block.ranking_expert.length; i++) {
      const exp = block.ranking_expert[i]!;
      const got = result.ranking[i]!;
      expect(got.iso3).toBe(exp.iso3);
      expect(got.rank).toBe(exp.rank);
      expect(Math.abs(got.score - exp.score)).toBeLessThanOrEqual(1e-9);
    }

    // Factor contributions for top country
    const top = block.ranking_expert[0]!.iso3;
    const expFs = block.factor_scores[top]!;
    const gotFs = result.factorScores[top]!;
    for (const [factor, val] of Object.entries(expFs)) {
      expect(Math.abs((gotFs[factor] ?? NaN) - val)).toBeLessThanOrEqual(1e-9);
    }
  });

  it("re-ranks 60 destinations in < 100 ms", () => {
    const golden = loadGolden();
    const block = golden.block;
    const variables: VariableSpec[] = block.variables.map((v) => ({
      id: v.id,
      factor: v.factor,
      direction: v.direction,
    }));
    const columns = variables.map((v) => v.id);
    const values = block.raw.map((row) =>
      columns.map((id) => {
        const v = row[id];
        return typeof v === "number" ? v : null;
      }),
    );

    // Warm-up
    scoreBlock({
      candidates: block.candidates,
      variables,
      values,
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "expert_mean",
      policy: { maxMissingShare: 0.2, minCandidates: 20 },
    });

    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      scoreBlock({
        candidates: block.candidates,
        variables,
        values,
        normalization: "minmax",
        mcdm: "wsm",
        weightScheme: i % 2 === 0 ? "expert_mean" : "equal",
        policy: { maxMissingShare: 0.2, minCandidates: 20 },
      });
    }
    const elapsed = performance.now() - t0;
    const perCall = elapsed / 20;
    expect(perCall).toBeLessThan(100);
  });
});
