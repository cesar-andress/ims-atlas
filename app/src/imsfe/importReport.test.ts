import { describe, expect, it } from "vitest";
import { parseImsfeImportReportJson, rankedScores } from "./importReport";

const SAMPLE = {
  path_label: "IMSFE footwear workbook",
  origin: "Colombia",
  hs_code: "64",
  scale: 10,
  n_criteria: 6,
  n_variables: 18,
  n_experts: 2,
  expert_labels: ["Expert 1", "Expert 2"],
  criterion_weights: { COST: 0.5, LOGI: 0.5 },
  variable_weights: { PPAD: 1, LPIN: 1 },
  variable_direction: { PPAD: "DMP", LPIN: "DMP" },
  final_scores: { Switzerland: 6.1193342709, Germany: 4.742819256 },
  preselected_countries: ["Switzerland", "Germany"],
  assumptions: [],
  warnings: [],
};

describe("parseImsfeImportReportJson", () => {
  it("accepts a valid anonymised report", () => {
    const r = parseImsfeImportReportJson(JSON.stringify(SAMPLE));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.origin).toBe("Colombia");
    expect(r.report.final_scores.Switzerland).toBeCloseTo(6.1193342709, 9);
  });

  it("rejects personal expert labels", () => {
    const bad = {
      ...SAMPLE,
      expert_labels: ["Professor 1 Daniel Bonilla Calle DONE"],
    };
    const r = parseImsfeImportReportJson(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("non_anonymous_expert");
  });

  it("rejects personal tokens in payload", () => {
    const bad = { ...SAMPLE, path_label: "Baena footwear" };
    const r = parseImsfeImportReportJson(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("personal_token");
  });

  it("ranks by score descending", () => {
    const ranked = rankedScores(SAMPLE.final_scores);
    expect(ranked[0]?.country).toBe("Switzerland");
    expect(ranked[1]?.country).toBe("Germany");
  });
});
