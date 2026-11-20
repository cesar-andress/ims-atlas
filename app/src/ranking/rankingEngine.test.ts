import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { computeRanking, overrideCriterionWeights } from "./rankingEngine";

const goldenPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../core/fixtures/phase8/synthetic_col_hs64.json",
);

describe("rankingEngine COL HS64", () => {
  beforeAll(() => {
    const text = readFileSync(goldenPath, "utf8");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => JSON.parse(text),
      })),
    );
  });

  it("matches imsfe expert ranking @ 1e-9", async () => {
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as {
      block: { ranking_expert: { iso3: string; score: number; rank: number }[] };
    };
    const model = await computeRanking({
      origin: "COL",
      hs: "64",
      year: 2023,
      weightScheme: "expert_mean",
      normalization: "minmax",
      mcdm: "wsm",
      missingThreshold: 0.2,
    });
    expect(model.ranking.length).toBe(60);
    expect(model.elapsedMs).toBeLessThan(100);
    for (let i = 0; i < golden.block.ranking_expert.length; i++) {
      const exp = golden.block.ranking_expert[i]!;
      const got = model.ranking[i]!;
      expect(got.iso3).toBe(exp.iso3);
      expect(Math.abs(got.score - exp.score)).toBeLessThanOrEqual(1e-9);
    }
  });

  it("wires ADVANCE zeroPolicy into scores", async () => {
    const base = await computeRanking({
      origin: "COL",
      hs: "64",
      year: 2023,
      weightScheme: "expert_mean",
      normalization: "ratio_legacy",
      mcdm: "wsm",
    });
    const eps = await computeRanking({
      origin: "COL",
      hs: "64",
      year: 2023,
      weightScheme: "expert_mean",
      normalization: "ratio_legacy",
      mcdm: "wsm",
      zeroPolicy: "epsilon",
      zeroEpsilon: 0.1,
    });
    expect(eps.warnings.some((w) => w.includes("Zero policy"))).toBe(true);
    // Same length; at least one score may move when zeros are substituted.
    expect(eps.ranking.length).toBe(base.ranking.length);
  });

  it("wires methodFamily tree + preselect top N", async () => {
    const model = await computeRanking({
      origin: "COL",
      hs: "64",
      year: 2023,
      methodFamily: "imsfe_2025",
      normalization: "ratio_legacy",
      mcdm: "wsm",
      preselectMode: "top_n",
      preselectTopN: 30,
      preselectPick: "imports",
    });
    expect(model.ranking.length).toBeLessThanOrEqual(30);
    expect(model.ranking.length).toBeGreaterThanOrEqual(20);
    expect(model.warnings.some((w) => w.includes("Criteria tree"))).toBe(true);
  });

  it("panel_all uses free panel variables without criteria tree", async () => {
    const model = await computeRanking({
      origin: "COL",
      hs: "64",
      year: 2023,
      methodFamily: "panel_all",
      weightScheme: "equal",
      normalization: "minmax",
      mcdm: "wsm",
    });
    expect(model.ranking.length).toBeGreaterThanOrEqual(20);
    expect(model.warnings.some((w) => w.includes("Criteria tree"))).toBe(false);
    expect(model.warnings.some((w) => w.includes("free selection"))).toBe(true);
  });

  it("honours explicit variableIds outside the IMSFE tree", async () => {
    const model = await computeRanking({
      origin: "COL",
      hs: "64",
      year: 2023,
      methodFamily: "imsfe_2025",
      variableIds: ["LPI", "TARIF", "EOC"],
      weightScheme: "equal",
      normalization: "minmax",
      mcdm: "wsm",
    });
    expect(model.ranking.length).toBeGreaterThanOrEqual(20);
    expect(model.warnings.some((w) => w.includes("Custom variable set"))).toBe(true);
  });
});

describe("overrideCriterionWeights", () => {
  const base = { COST: 0.5, LOGI: 0.3, COMM: 0.2 };

  it("returns the expert weights untouched when nothing is overridden", () => {
    expect(overrideCriterionWeights(base, undefined)).toBe(base);
    expect(overrideCriterionWeights(base, { demand: 1 })).toBe(base);
  });

  it("normalises manual criterion weights to sum 1", () => {
    const out = overrideCriterionWeights(base, { COST: 2, LOGI: 1, COMM: 1 });
    expect(out.COST).toBeCloseTo(0.5, 12);
    expect(out.LOGI).toBeCloseTo(0.25, 12);
    expect(out.COMM).toBeCloseTo(0.25, 12);
  });

  it("falls back to the expert weights when every override is zero", () => {
    expect(overrideCriterionWeights(base, { COST: 0, LOGI: 0, COMM: 0 })).toBe(base);
  });
});
