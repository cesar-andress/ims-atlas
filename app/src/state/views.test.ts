import { describe, expect, it } from "vitest";
import { SECONDARY_GROUPS, SECONDARY_VIEWS } from "./views";

describe("SECONDARY_VIEWS (R2)", () => {
  it("keeps at most 7 links", () => {
    expect(SECONDARY_VIEWS.length).toBeLessThanOrEqual(7);
    expect(SECONDARY_VIEWS.length).toBe(
      SECONDARY_GROUPS.reduce((n, g) => n + g.views.length, 0),
    );
  });

  it("includes advanced_tools hub and excludes project sub-pages", () => {
    expect(SECONDARY_VIEWS).toContain("advanced_tools");
    expect(SECONDARY_VIEWS).not.toContain("project_dashboard");
    expect(SECONDARY_VIEWS).not.toContain("project_variables");
    expect(SECONDARY_VIEWS).not.toContain("sql");
    expect(SECONDARY_VIEWS).not.toContain("design");
  });
});
