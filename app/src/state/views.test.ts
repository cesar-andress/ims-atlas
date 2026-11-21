import { describe, expect, it } from "vitest";
import { PROJECT_STEP_VIEWS, projectStepOf, RESULT_VIEWS } from "./views";

describe("projectStepOf", () => {
  it("maps the six Prompt 4d steps", () => {
    expect(PROJECT_STEP_VIEWS).toEqual([
      "datos",
      "variables",
      "analisis",
      "mercado_objetivo",
      "plan_4p",
      "preparar_envio",
    ]);
    expect(projectStepOf("datos")).toBe(1);
    expect(projectStepOf("variables")).toBe(2);
    expect(projectStepOf("analisis")).toBe(3);
    expect(projectStepOf("mercado_objetivo")).toBe(4);
    expect(projectStepOf("plan_4p")).toBe(5);
    expect(projectStepOf("preparar_envio")).toBe(6);
  });

  it("keeps result tabs on step 3", () => {
    for (const view of RESULT_VIEWS) {
      expect(projectStepOf(view)).toBe(3);
    }
  });

  it("returns null outside project steps", () => {
    for (const view of ["home", "docs", "projects", "cite"] as const) {
      expect(projectStepOf(view)).toBeNull();
    }
  });
});
