import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "./projectModel";
import {
  __resetProjectLibraryForTests,
  listProjects as idbList,
  upsertProject as idbUpsert,
} from "./projectIdb";
import {
  __resetProjectLibraryModeForTests,
  deleteProject,
  duplicateProject,
  getProject,
  getProjectLibraryMode,
  listProjects,
  setProjectLibraryMode,
  uploadLocalProjectsToTeam,
  upsertProject,
} from "./projectLibrary";

describe("projectLibrary facade", () => {
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

  it("stays on local IndexedDB when mode is local", async () => {
    expect(getProjectLibraryMode()).toBe("local");
    const p = createEmptyProject({
      name: "Local only",
      config: { v: 1, view: "datos", origin: "COL", hs: "64", year: 2023 },
    });
    await upsertProject(p);
    const rows = await listProjects();
    expect(rows.some((r) => r.id === p.id && r.source === "local")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the team API when mode is team and health is ok", async () => {
    setProjectLibraryMode("team");
    const remote = createEmptyProject({
      id: "team-1",
      name: "Shared",
      config: { v: 1, view: "analisis", origin: "COL", hs: "64", year: 2023 },
      yearFrom: 2023,
      yearTo: 2023,
    });

    fetchMock
      // health
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      // list
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: remote.id,
            name: remote.name,
            createdAt: remote.createdAt,
            updatedAt: remote.updatedAt,
            createdBy: "cesar",
            updatedBy: "cesar",
            source: "team",
            origin: "COL",
            hs: "64",
            yearFrom: 2023,
            yearTo: 2023,
          },
        ],
      });

    const rows = await listProjects();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("team");
    expect(rows[0]?.updatedBy).toBe("cesar");

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => remote,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...remote, name: "Shared edited" }),
      });

    const opened = await getProject(remote.id);
    expect(opened?.name).toBe("Shared");

    const saved = await upsertProject({ ...remote, name: "Shared edited" });
    expect(saved.name).toBe("Shared edited");
  });

  it("falls back to local when the team API fails", async () => {
    setProjectLibraryMode("team");
    const local = createEmptyProject({
      name: "Fallback",
      config: { v: 1, view: "datos" },
    });
    await idbUpsert(local);

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "boom" }),
      });

    const rows = await listProjects();
    expect(rows.some((r) => r.id === local.id)).toBe(true);
  });

  it("saves an incomplete draft locally and flags team fallback", async () => {
    const draft = createEmptyProject({
      name: "Borrador vacío",
      config: { v: 1, view: "variables" },
    });
    const localOnly = await upsertProject(draft);
    expect(localOnly.teamSync).toBe("local_only");
    expect(localOnly.config.origin).toBeUndefined();
    expect(await getProject(draft.id)).not.toBeNull();

    setProjectLibraryMode("team");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockRejectedValueOnce(new Error("network down"));

    const fallback = await upsertProject({
      ...draft,
      name: "Borrador con fallo de equipo",
      updatedAt: new Date().toISOString(),
    });
    expect(fallback.teamSync).toBe("local_fallback");
    expect(fallback.name).toBe("Borrador con fallo de equipo");
  });

  it("duplicates through the active library and uploads local projects", async () => {
    const p = createEmptyProject({
      name: "Base",
      config: { v: 1, view: "datos", origin: "ESP", hs: "09", year: 2022 },
    });
    await upsertProject(p);
    const copy = await duplicateProject(p.id, "copia");
    expect(copy.name).toContain("copia");
    expect(await getProject(copy.id)).not.toBeNull();
    await deleteProject(copy.id);
    expect(await getProject(copy.id)).toBeNull();

    setProjectLibraryMode("team");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploaded: 1, projects: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
    expect(await uploadLocalProjectsToTeam()).toBe(1);

    __resetProjectLibraryModeForTests();
    expect(await uploadLocalProjectsToTeam()).toBe(0);
    expect((await idbList()).length).toBeGreaterThan(0);
  });
});
