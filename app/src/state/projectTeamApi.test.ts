import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyProject } from "./projectModel";
import {
  teamApiAvailable,
  teamDeleteProject,
  teamGetProject,
  teamListProjects,
  teamMigrateLocal,
  teamUpsertProject,
} from "./projectTeamApi";

describe("projectTeamApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("teamApiAvailable is true only when health returns ok", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });
    expect(await teamApiAvailable()).toBe(true);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false }),
    });
    expect(await teamApiAvailable()).toBe(false);

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await teamApiAvailable()).toBe(false);
  });

  it("lists, gets, upserts, deletes and migrates team projects", async () => {
    const project = createEmptyProject({
      id: "p1",
      name: "HS64 COL",
      config: { v: 1, view: "analisis", origin: "COL", hs: "64", year: 2023 },
      yearFrom: 2023,
      yearTo: 2023,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "p1",
          name: "HS64 COL",
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          createdBy: "ana",
          updatedBy: "bob",
          source: "team",
          origin: "COL",
          hs: "64",
          yearFrom: 2023,
          yearTo: 2023,
        },
      ],
    });
    const listed = await teamListProjects();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.updatedBy).toBe("bob");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...project, _meta: { createdBy: "ana" } }),
    });
    const got = await teamGetProject("p1");
    expect(got?.id).toBe("p1");
    expect(got && "_meta" in got).toBe(false);

    fetchMock.mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: async () => ({ error: "missing" }),
    });
    expect(await teamGetProject("missing")).toBeNull();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => project,
    });
    const saved = await teamUpsertProject(project);
    expect(saved.name).toBe("HS64 COL");
    expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("PUT");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });
    await teamDeleteProject("p1");
    expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("DELETE");

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploaded: 1, projects: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => listed,
      });
    const migrated = await teamMigrateLocal([project]);
    expect(migrated.uploaded).toBe(1);
    expect(migrated.projects).toHaveLength(1);
  });

  it("surfaces API errors with the server message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Authentication required." }),
    });
    await expect(teamListProjects()).rejects.toThrow(/Authentication required/);
  });

  it("throws TeamProjectsApiError with code on 409 name_conflict", async () => {
    const { TeamProjectsApiError } = await import("./projectTeamApi");
    const project = createEmptyProject({
      id: "p-conflict",
      name: "Proyecto nuevo",
      config: { v: 1, view: "analisis" },
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        error: "A project with this name already exists.",
        code: "name_conflict",
      }),
    });
    try {
      await teamUpsertProject(project);
      expect.unreachable("expected name_conflict");
    } catch (err) {
      expect(err).toBeInstanceOf(TeamProjectsApiError);
      expect(err).toMatchObject({
        status: 409,
        code: "name_conflict",
        message: expect.stringMatching(/already exists/i),
      });
    }
  });
});
