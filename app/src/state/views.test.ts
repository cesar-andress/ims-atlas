import { describe, expect, it } from "vitest";
import {
  isProjectScreen,
  preferredProjectView,
  PROJECT_STEP_VIEWS,
  projectStepOf,
  RESULT_VIEWS,
} from "./views";

describe("project steps", () => {
  it("has exactly three steps in order Datos, Variables, Resultados", () => {
    expect(PROJECT_STEP_VIEWS).toEqual(["datos", "variables", "analisis"]);
    expect(projectStepOf("datos")).toBe(1);
    expect(projectStepOf("variables")).toBe(2);
    expect(projectStepOf("analisis")).toBe(3);
  });

  it("maps every result view to step 3 and shows the project bar", () => {
    for (const view of RESULT_VIEWS) {
      expect(projectStepOf(view)).toBe(3);
      expect(isProjectScreen(view)).toBe(true);
    }
  });

  it("keeps Home and static pages free of the project bar", () => {
    for (const view of ["home", "projects", "docs", "data_sources", "cite"] as const) {
      expect(isProjectScreen(view)).toBe(false);
      expect(projectStepOf(view)).toBeNull();
    }
  });

  it("opens ready projects on Resultados and incomplete ones on Datos", () => {
    expect(
      preferredProjectView({
        v: 1,
        view: "project_dashboard",
        origin: "COL",
        hs: "64",
        year: 2019,
      }),
    ).toBe("analisis");
    expect(preferredProjectView({ v: 1, view: "project_dashboard" })).toBe("datos");
  });
});
