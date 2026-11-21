import { describe, expect, it } from "vitest";
import {
  applyCatalogTransformValue,
  applyCatalogTransforms,
  dropCoWeightedAliases,
} from "./catalogTransform.js";
import { normalizeMinmax } from "./normalize.js";
import { scoreBlock } from "./score.js";
import type { VariableSpec } from "./types.js";

describe("catalogTransform", () => {
  it("log uses ln(1+x) and keeps zeros finite", () => {
    expect(applyCatalogTransformValue(0, "log")).toBeCloseTo(0, 12);
    expect(applyCatalogTransformValue(Math.E - 1, "log")).toBeCloseTo(1, 12);
    expect(applyCatalogTransformValue(null, "log")).toBeNull();
  });

  it("log compresses the share of the max cell under minmax", () => {
    const raw = [1, 10, 100, 1000];
    const logged = raw.map((x) => applyCatalogTransformValue(x, "log")!);
    const nRaw = normalizeMinmax(raw, "benefit");
    const nLog = normalizeMinmax(logged, "benefit");
    // Mid points retain more of the [0,10] scale after log.
    expect(nLog[1]!).toBeGreaterThan(nRaw[1]!);
    expect(nLog[2]!).toBeGreaterThan(nRaw[2]!);
  });

  it("dropCoWeightedAliases prefers canonical over LPIN/CLI/INAN/UNRA", () => {
    const vars: VariableSpec[] = [
      { id: "LPI", factor: "logistics", direction: "benefit" },
      { id: "LPIN", factor: "logistics", direction: "benefit", aliasOf: "LPI" },
      { id: "PLI", factor: "cost_access", direction: "cost" },
      { id: "CLI", factor: "cost_access", direction: "cost", aliasOf: "PLI" },
    ];
    const { kept, dropped } = dropCoWeightedAliases(vars);
    expect(dropped.sort()).toEqual(["CLI", "LPIN"]);
    expect(kept.map((v) => v.id).sort()).toEqual(["LPI", "PLI"]);
  });

  it("scoreBlock applies log transform on marked columns", () => {
    const variables: VariableSpec[] = [
      { id: "IMPV", factor: "demand", direction: "benefit", transform: "log" },
    ];
    const candidates = Array.from(
      { length: 20 },
      (_, i) => `C${String(i).padStart(2, "0")}`,
    );
    // One huge importer + many small ones.
    const values = candidates.map((_, i) => [i === 0 ? 600_000 : 1_000 + i * 10]);
    const policy = { maxMissingShare: 1, minCandidates: 20, impute: "median" as const };
    const withLog = scoreBlock({
      candidates,
      variables,
      values,
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "equal",
      policy,
    });
    const noLog = scoreBlock({
      candidates,
      variables: [
        { id: "IMPV", factor: "demand", direction: "benefit", transform: "none" },
      ],
      values,
      normalization: "minmax",
      mcdm: "wsm",
      weightScheme: "equal",
      policy,
    });
    const topLog = withLog.ranking[0]!.score;
    const secondLog = withLog.ranking[1]!.score;
    const topRaw = noLog.ranking[0]!.score;
    const secondRaw = noLog.ranking[1]!.score;
    expect(topLog - secondLog).toBeLessThan(topRaw - secondRaw);
    expect(withLog.ranking[0]!.iso3).toBe("C00");
  });

  it("applyCatalogTransforms is column-wise", () => {
    const matrix = [
      [0, 10],
      [3, 20],
    ];
    const vars: VariableSpec[] = [
      { id: "A", factor: "f", direction: "benefit", transform: "log" },
      { id: "B", factor: "f", direction: "benefit", transform: "none" },
    ];
    const out = applyCatalogTransforms(matrix, vars);
    expect(out[0]![0]).toBeCloseTo(0, 12);
    expect(out[0]![1]).toBe(10);
    expect(out[1]![1]).toBe(20);
  });
});
