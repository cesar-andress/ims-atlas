import { describe, expect, it } from "vitest";
import { collectMethodWarnings } from "./collectMethodWarnings";
import type { AnalysisConfig } from "../state/schema";

const base = {
  v: 1 as const,
  view: "ranking" as const,
};

describe("collectMethodWarnings", () => {
  it("adds discontinued CIBC and culture workbook note", () => {
    const w = collectMethodWarnings(base as AnalysisConfig);
    expect(w.some((x) => x.code === "discontinued_series")).toBe(true);
    expect(w.some((x) => x.code === "culture_default_workbook")).toBe(true);
  });

  it("flags aggregated olive-oil respondents", () => {
    const w = collectMethodWarnings({
      ...base,
      methodFamily: "imsfem_2025_olive",
    } as AnalysisConfig);
    expect(w.some((x) => x.code === "aggregated_respondents")).toBe(true);
  });
});
