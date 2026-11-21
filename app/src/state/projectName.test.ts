import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectModel";
import {
  isGenericProjectName,
  isNameConflictError,
  preferredSaveName,
  withNameDisambiguation,
} from "./projectName";
import { TeamProjectsApiError } from "./projectTeamApi";

describe("projectName helpers", () => {
  it("detects generic default titles", () => {
    expect(isGenericProjectName("Proyecto nuevo")).toBe(true);
    expect(isGenericProjectName("New project")).toBe(true);
    expect(isGenericProjectName("")).toBe(true);
    expect(isGenericProjectName("Café · España · 2024")).toBe(false);
  });

  it("prefers a scope-derived name when the title is still generic", () => {
    const project = createEmptyProject({
      name: "Proyecto nuevo",
      config: { v: 1, view: "variables", origin: "ESP", hs: "8901", year: 2024 },
    });
    const preferred = preferredSaveName(project);
    expect(preferred).not.toBe("Proyecto nuevo");
    expect(preferred).toContain("España");
    expect(preferred).toContain("2024");
  });

  it("keeps an explicit custom name", () => {
    const project = createEmptyProject({
      name: "Mi estudio ladrillos",
      config: { v: 1, view: "variables", origin: "ESP", hs: "8901", year: 2024 },
    });
    expect(preferredSaveName(project)).toBe("Mi estudio ladrillos");
  });

  it("disambiguates without stacking suffixes", () => {
    expect(withNameDisambiguation("Proyecto nuevo", 1)).toBe("Proyecto nuevo");
    expect(withNameDisambiguation("Proyecto nuevo", 2)).toBe("Proyecto nuevo (2)");
    expect(withNameDisambiguation("Proyecto nuevo (2)", 3)).toBe("Proyecto nuevo (3)");
  });

  it("recognises structured name_conflict errors", () => {
    expect(
      isNameConflictError(
        new TeamProjectsApiError(
          409,
          "A project with this name already exists.",
          "name_conflict",
        ),
      ),
    ).toBe(true);
    expect(
      isNameConflictError(new TeamProjectsApiError(403, "Only the owner", "forbidden")),
    ).toBe(false);
    expect(isNameConflictError(new Error("network"))).toBe(false);
  });
});
