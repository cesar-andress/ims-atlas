import { describe, expect, it } from "vitest";
import {
  AnalysisConfigSchema,
  ProjectFileSchema,
  ViewIdSchema,
  parseAnalysisConfig,
} from "./schema";

describe("schema (zod-free)", () => {
  it("parses a compact config", () => {
    const cfg = parseAnalysisConfig({
      v: 1,
      view: "ranking",
      origin: "col",
      year: 2023,
      hs: "64",
      weightScheme: "expert_mean",
    });
    expect(cfg.origin).toBe("COL");
    expect(cfg.view).toBe("ranking");
    expect(cfg.hs).toBe("64");
  });

  it("rejects bad version", () => {
    expect(() => AnalysisConfigSchema.parse({ v: 2, view: "home" })).toThrow();
  });

  it("ViewIdSchema.safeParse matches former zod API", () => {
    expect(ViewIdSchema.safeParse("catalog")).toEqual({
      success: true,
      data: "catalog",
    });
    expect(ViewIdSchema.safeParse("nope").success).toBe(false);
  });

  it("parses project files", () => {
    const file = ProjectFileSchema.parse({
      kind: "ims-atlas-project",
      savedAt: "2026-01-01T00:00:00.000Z",
      config: { v: 1, view: "home" },
      label: "demo",
    });
    expect(file.label).toBe("demo");
    expect(file.config.view).toBe("home");
  });
});
