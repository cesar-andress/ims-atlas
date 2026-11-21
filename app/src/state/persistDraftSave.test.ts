import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "./projectModel";
import { __resetProjectLibraryForTests } from "./projectIdb";
import {
  __resetProjectLibraryModeForTests,
  setProjectLibraryMode,
  upsertProject,
} from "./projectLibrary";
import { persistActiveProject, projectFromConfig } from "./projectStore";

describe("Prompt 4b incomplete draft save", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    __resetProjectLibraryForTests();
    __resetProjectLibraryModeForTests();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetProjectLibraryModeForTests();
  });

  it("persistActiveProject accepts empty origin/product/year", async () => {
    const proj = projectFromConfig(
      { v: 1, view: "variables", lang: "es" },
      "Proyecto nuevo",
    );
    expect(proj.config.origin).toBeUndefined();
    expect(proj.config.hs).toBeUndefined();
    expect(proj.config.year).toBeUndefined();

    const saved = await persistActiveProject(proj);
    expect(saved.name).toBe("Proyecto nuevo");
    expect(saved.teamSync).toBe("local_only");
  });

  it("reports Spanish-facing teamSync local_fallback when team API fails", async () => {
    setProjectLibraryMode("team");
    const draft = createEmptyProject({
      name: "Borrador",
      config: { v: 1, view: "variables", lang: "es" },
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockRejectedValueOnce(new Error("500"));

    const saved = await upsertProject(draft);
    expect(saved.teamSync).toBe("local_fallback");
  });
});
