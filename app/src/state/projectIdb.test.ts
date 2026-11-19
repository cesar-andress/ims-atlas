import { describe, expect, it, beforeEach } from "vitest";
import { createEmptyProject } from "./projectModel";
import {
  __resetProjectLibraryForTests,
  deleteProject,
  duplicateProject,
  getProject,
  listProjects,
  upsertProject,
} from "./projectIdb";

describe("projectIdb memory mode", () => {
  beforeEach(() => {
    __resetProjectLibraryForTests();
  });

  it("upserts, lists, duplicates and deletes", async () => {
    const p = createEmptyProject({
      name: "A",
      config: { v: 1, view: "builder", origin: "COL", hs: "64", year: 2023 },
    });
    await upsertProject(p);
    expect((await listProjects()).map((x) => x.name)).toContain("A");
    const copy = await duplicateProject(p.id);
    expect(copy.name).toContain("copy");
    expect(await getProject(copy.id)).not.toBeNull();
    await deleteProject(p.id);
    expect(await getProject(p.id)).toBeNull();
  });
});
