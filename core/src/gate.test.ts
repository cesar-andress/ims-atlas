import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  gate,
  type GateDecision,
  type SourceRights,
  type YesNoUnknown,
} from "./gate.js";

const here = dirname(fileURLToPath(import.meta.url));
const casesPath = join(here, "../../catalog/gate_cases.json");
const cases = JSON.parse(readFileSync(casesPath, "utf8")) as Array<{
  id: string;
  source_rights: SourceRights | SourceRights[];
  variable: unknown;
  deployment: { commercial_context?: boolean };
  expected_decision: GateDecision;
}>;

const FLAGS = [
  "use_research",
  "redistribute_raw",
  "redistribute_derived",
  "commercial_use",
  "attribution_required",
  "share_alike",
  "no_derivatives",
] as const;

const ynu = fc.constantFrom<YesNoUnknown>("yes", "no", "unknown");

function completeRights(partial: Partial<SourceRights>): SourceRights {
  return {
    licence_id: "CC-BY-4.0",
    use_research: "yes",
    redistribute_raw: "yes",
    redistribute_derived: "yes",
    commercial_use: "yes",
    attribution_required: "yes",
    share_alike: "no",
    no_derivatives: "no",
    evidence: {
      checked_by: "Tester",
      checked_on: "2026-11-19",
      terms_url: "https://example.test/terms",
      snapshot_sha256: "abc",
    },
    ...partial,
  };
}

describe("shared gate_cases.json", () => {
  for (const testCase of cases) {
    it(testCase.id, () => {
      const result = gate(
        testCase.source_rights,
        testCase.variable as never,
        testCase.deployment,
      );
      expect(result.decision).toBe(testCase.expected_decision);
    });
  }
});

describe("property: unknown never ships", () => {
  it("any unknown flag blocks ship_*", () => {
    fc.assert(
      fc.property(fc.constantFrom(...FLAGS), ynu, ynu, (flag, a, b) => {
        const rights = completeRights({
          use_research: a,
          redistribute_raw: b,
          [flag]: "unknown",
        });
        const result = gate(rights, null, { commercial_context: true });
        expect(["ship_raw", "ship_derived"]).not.toContain(result.decision);
      }),
      { numRuns: 60 },
    );
  });
});

describe("property: no_derivatives never ship_derived", () => {
  it("blocks ship_derived", () => {
    fc.assert(
      fc.property(ynu, ynu, (raw, derived) => {
        const rights = completeRights({
          redistribute_raw: raw === "unknown" ? "no" : raw,
          redistribute_derived: derived === "unknown" ? "yes" : derived,
          no_derivatives: "yes",
          commercial_use: "yes",
          use_research: "yes",
        });
        const result = gate(rights, null, { commercial_context: true });
        expect(result.decision).not.toBe("ship_derived");
      }),
      { numRuns: 40 },
    );
  });
});

describe("property: commercial_use=no + commercial_context", () => {
  it("never ships", () => {
    const rights = completeRights({ commercial_use: "no" });
    const result = gate(rights, null, { commercial_context: true });
    expect(["ship_raw", "ship_derived"]).not.toContain(result.decision);
  });
});
