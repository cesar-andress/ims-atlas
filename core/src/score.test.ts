import { describe, expect, it } from "vitest";
import { compareScoreDescending } from "./math.js";
import { scoreBlock } from "./score.js";

describe("compareScoreDescending", () => {
  it("ranks finite scores above missing (NaN) scores", () => {
    const rows = [
      { iso3: "ABW", score: Number.NaN },
      { iso3: "AFG", score: Number.NaN },
      { iso3: "AGO", score: 0.6 },
      { iso3: "ARE", score: 1.9 },
      { iso3: "ARM", score: 2.09 },
    ];
    const ordered = [...rows].sort((a, b) =>
      compareScoreDescending(a.score, b.score, a.iso3.localeCompare(b.iso3)),
    );
    expect(ordered.map((r) => r.iso3)).toEqual(["ARM", "ARE", "AGO", "ABW", "AFG"]);
    expect(ordered.slice(0, 3).every((r) => Number.isFinite(r.score))).toBe(true);
  });

  it("does not let NaN || localeCompare promote missing ISO codes", () => {
    const broken = [
      { iso3: "ABW", score: Number.NaN },
      { iso3: "ARM", score: 2.09 },
    ].sort((a, b) => b.score - a.score || a.iso3.localeCompare(b.iso3));
    expect(broken[0]!.iso3).toBe("ABW");

    const fixed = [
      { iso3: "ABW", score: Number.NaN },
      { iso3: "ARM", score: 2.09 },
    ].sort((a, b) =>
      compareScoreDescending(a.score, b.score, a.iso3.localeCompare(b.iso3)),
    );
    expect(fixed[0]!.iso3).toBe("ARM");
  });
});

describe("scoreBlock ranking construction with NaN scores", () => {
  it("never places NaN scores in the top-N before finite scores", () => {
    const candidates = ["ABW", "AFG", "AGO", "ARE", "ARM"];
    const scores = [Number.NaN, Number.NaN, 0.6, 1.9, 2.09];
    const ranking = scores
      .map((score, i) => ({ iso3: candidates[i]!, score }))
      .sort((a, b) =>
        compareScoreDescending(a.score, b.score, a.iso3.localeCompare(b.iso3)),
      )
      .map((row, rank0) => ({ ...row, rank: rank0 + 1 }));

    const top3 = ranking.slice(0, 3);
    expect(top3.every((r) => Number.isFinite(r.score))).toBe(true);
    expect(top3.map((r) => r.iso3)).toEqual(["ARM", "ARE", "AGO"]);
    expect(ranking.filter((r) => !Number.isFinite(r.score)).map((r) => r.iso3)).toEqual(
      ["ABW", "AFG"],
    );
  });

  it("keeps finite-only scoreBlock order unchanged", () => {
    const result = scoreBlock({
      candidates: ["AGO", "ARE", "ARM"],
      variables: [
        { id: "GDP", factor: "market", direction: "benefit" },
        { id: "LPI", factor: "access", direction: "benefit" },
      ],
      values: [
        [10, 2],
        [40, 4],
        [50, 5],
      ],
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "equal",
      policy: { maxMissingShare: 0.2, minCandidates: 2, impute: "median" },
    });
    expect(result.ranking.map((r) => r.iso3)).toEqual(["ARM", "ARE", "AGO"]);
    expect(result.ranking.every((r) => Number.isFinite(r.score))).toBe(true);
  });
});
