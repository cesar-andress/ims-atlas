import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { baselineScores } from "./baselines.js";
import { makeWalkForwardSplit, type BlockMetricRow } from "./backtest.js";
import { bootstrapPairedDeltas } from "./bootstrap.js";
import {
  aucExt,
  evaluateRanking,
  ndcgAtK,
  precisionAtK,
  spearmanCorr,
} from "./metrics.js";
import { createRng } from "./rng.js";
import {
  dirichletConcentration,
  pTopK,
  ranksFromScores,
  runSmaaWsm,
  type WeightStats,
} from "./smaa.js";

const TOL = 1e-9;

type Golden = {
  tolerance_exact: number;
  smaa_accept_tol: number;
  metrics: {
    id: string;
    score: Record<string, number>;
    y_int: Record<string, number>;
    y_ext: Record<string, number>;
    expected: Record<string, number>;
  }[];
  splits: {
    years: number[];
    first_test_year: number;
    horizon: number;
    train: number[];
    test: number[];
  }[];
  baselines: {
    candidates: string[];
    import_volume_raw: Record<string, number>;
    import_volume_scores: Record<string, number>;
    gravity_scores: Record<string, number>;
  };
  smaa: {
    alternatives: string[];
    columns: string[];
    normalized: number[][];
    stats: WeightStats;
    seed: number;
    n_samples: number;
    kappa: number;
    weight_samples_50: number[][];
    weight_names: string[];
    scores_50: number[][];
    ranks_50: number[][];
    acceptability: number[][];
    p_top_3: number[];
    central_weights: number[];
    accept_tol: number;
  };
  bootstrap: {
    rows: {
      origin: string;
      year: number;
      method: string;
      family: string;
      target: string;
      horizon: number;
      "ndcg@10": number;
    }[];
    observed_means: { method: string; mean: number }[];
    paired: {
      method: string;
      baseline: string;
      delta_mean: number;
    }[];
    n_reps: number;
    seed: number;
  };
};

function loadGolden(): Golden {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "fixtures", "phase6", "golden.json");
  return JSON.parse(readFileSync(path, "utf8")) as Golden;
}

function expectClose(a: number, e: number, label: string, tol = TOL) {
  if (!Number.isFinite(a) && !Number.isFinite(e)) return;
  const diff = Math.abs(a - e);
  if (diff > tol) throw new Error(`${label}: |${a} - ${e}| = ${diff} > ${tol}`);
}

const golden = loadGolden();

describe("phase6 golden vs ims-backtest", () => {
  describe("metrics (exact)", () => {
    for (const c of golden.metrics) {
      it(c.id, () => {
        const got = evaluateRanking(c.score, { yInt: c.y_int, yExt: c.y_ext });
        for (const [k, e] of Object.entries(c.expected)) {
          expectClose(got[k]!, e, `${c.id}.${k}`);
        }
        expectClose(
          ndcgAtK(c.score, c.y_int, 10),
          c.expected["ndcg@10"]!,
          `${c.id} ndcg`,
        );
        expectClose(
          precisionAtK(c.score, c.y_int, 10),
          c.expected["precision@10"]!,
          `${c.id} prec`,
        );
        expectClose(
          spearmanCorr(c.score, c.y_int),
          c.expected.spearman!,
          `${c.id} rho`,
        );
        expectClose(aucExt(c.score, c.y_ext), c.expected.auc!, `${c.id} auc`);
      });
    }
  });

  describe("walk-forward splits (exact)", () => {
    for (const s of golden.splits) {
      it(`horizon ${s.horizon}`, () => {
        const split = makeWalkForwardSplit(s.years, {
          firstTestYear: s.first_test_year,
          horizon: s.horizon,
        });
        expect(split.trainFeatureYears).toEqual(s.train);
        expect(split.testFeatureYears).toEqual(s.test);
      });
    }
  });

  describe("baselines (exact import_volume / gravity)", () => {
    it("import_volume and gravity", () => {
      const b = golden.baselines;
      const imp = baselineScores(b.candidates, "import_volume", {
        importVolume: b.import_volume_raw,
      });
      for (const id of b.candidates) {
        expectClose(imp[id]!, b.import_volume_scores[id]!, `imp ${id}`);
      }
      const grav = baselineScores(b.candidates, "gravity", {
        gravityScores: b.gravity_scores,
      });
      for (const id of b.candidates) {
        expectClose(grav[id]!, b.gravity_scores[id]!, `grav ${id}`);
      }
    });
  });

  describe("SMAA", () => {
    const s = golden.smaa;

    it("kappa MoM matches", () => {
      expectClose(
        dirichletConcentration(s.stats.factorMu, s.stats.factorSigma),
        s.kappa,
        "kappa",
      );
    });

    it("WSM on exported weight samples is byte-exact (1e-9)", () => {
      const result = runSmaaWsm(s.normalized, s.alternatives, s.columns, s.stats, {
        weightSamples: s.weight_samples_50,
        weightNames: s.weight_names,
      });
      for (let i = 0; i < s.scores_50.length; i++) {
        for (let t = 0; t < s.scores_50[0]!.length; t++) {
          expectClose(result.scores[i]![t]!, s.scores_50[i]![t]!, `score[${i},${t}]`);
        }
      }
      const ranks = ranksFromScores(result.scores);
      for (let i = 0; i < s.ranks_50.length; i++) {
        for (let t = 0; t < s.ranks_50[0]!.length; t++) {
          expect(ranks[i]![t]).toBe(s.ranks_50[i]![t]);
        }
      }
    });

    it("full SMAA acceptability within statistical tolerance vs Python", () => {
      const result = runSmaaWsm(s.normalized, s.alternatives, s.columns, s.stats, {
        nSamples: s.n_samples,
        seed: s.seed,
        mode: "dirichlet",
      });
      let maxAbs = 0;
      for (let i = 0; i < s.acceptability.length; i++) {
        for (let r = 0; r < s.acceptability[0]!.length; r++) {
          maxAbs = Math.max(
            maxAbs,
            Math.abs(result.acceptability[i]![r]! - s.acceptability[i]![r]!),
          );
        }
      }
      expect(maxAbs).toBeLessThanOrEqual(s.accept_tol);
      const p3 = pTopK(result.ranks, 3);
      let maxP = 0;
      for (let i = 0; i < p3.length; i++) {
        maxP = Math.max(maxP, Math.abs(p3[i]! - s.p_top_3[i]!));
      }
      expect(maxP).toBeLessThanOrEqual(s.accept_tol);
    });

    it("same seed => identical TS SMAA", () => {
      const a = runSmaaWsm(s.normalized, s.alternatives, s.columns, s.stats, {
        nSamples: 200,
        seed: 99,
      });
      const b = runSmaaWsm(s.normalized, s.alternatives, s.columns, s.stats, {
        nSamples: 200,
        seed: 99,
      });
      expect(a.scores).toEqual(b.scores);
      expect(a.ranks).toEqual(b.ranks);
    });
  });

  describe("bootstrap observed means (exact) + paired delta means", () => {
    it("observed means and delta_mean", () => {
      const rows: BlockMetricRow[] = golden.bootstrap.rows.map((r) => ({
        origin: r.origin,
        year: r.year,
        method: r.method,
        family: r.family as "ims" | "baseline",
        target: r.target as "intensive",
        horizon: r.horizon,
        metrics: { "ndcg@10": r["ndcg@10"] },
      }));
      for (const obs of golden.bootstrap.observed_means) {
        const vals = rows
          .filter((r) => r.method === obs.method)
          .map((r) => r.metrics["ndcg@10"]!);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        expectClose(mean, obs.mean, `mean ${obs.method}`);
      }
      const paired = bootstrapPairedDeltas(rows, {
        methods: ["ims_wsm"],
        baselines: ["import_volume", "gravity", "random"],
        metric: "ndcg@10",
        nReps: golden.bootstrap.n_reps,
        seed: golden.bootstrap.seed,
      });
      for (const exp of golden.bootstrap.paired) {
        const got = paired.find(
          (p) => p.method === exp.method && p.baseline === exp.baseline,
        );
        expect(got).toBeTruthy();
        expectClose(got!.deltaMean, exp.delta_mean, `delta ${exp.baseline}`);
      }
    });
  });

  it("Mulberry32 is deterministic", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.random());
    const seqB = Array.from({ length: 20 }, () => b.random());
    expect(seqA).toEqual(seqB);
  });
});
