/**
 * Project library facade: team API when authenticated, IndexedDB otherwise.
 * PLAN §2ter — proyectos compartidos por el equipo.
 */

import {
  createEmptyProject,
  type AtlasProject,
  type ProjectListItem,
} from "./projectModel";
import {
  deleteProject as idbDeleteProject,
  getLibraryStatus,
  getProject as idbGetProject,
  listProjects as idbListProjects,
  upsertProject as idbUpsertProject,
  type ProjectLibraryStatus,
} from "./projectIdb";
import {
  teamApiAvailable,
  teamDeleteProject,
  teamGetProject,
  teamListProjects,
  teamMigrateLocal,
  teamUpsertProject,
} from "./projectTeamApi";

export type ProjectLibraryMode = "local" | "team";

let mode: ProjectLibraryMode = "local";
let teamProbe: Promise<boolean> | null = null;

export function setProjectLibraryMode(next: ProjectLibraryMode): void {
  mode = next;
  teamProbe = null;
}

export function getProjectLibraryMode(): ProjectLibraryMode {
  return mode;
}

/** Test helper: force local mode and clear the team probe cache. */
export function __resetProjectLibraryModeForTests(): void {
  mode = "local";
  teamProbe = null;
}

async function teamBackendReady(): Promise<boolean> {
  if (mode !== "team") return false;
  if (!teamProbe) teamProbe = teamApiAvailable();
  return teamProbe;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  if (await teamBackendReady()) {
    try {
      return await teamListProjects();
    } catch {
      /* fall through to local mirror */
    }
  }
  const rows = await idbListProjects();
  return rows.map((r) => ({ ...r, source: "local" as const }));
}

export async function getProject(id: string): Promise<AtlasProject | null> {
  if (await teamBackendReady()) {
    try {
      const remote = await teamGetProject(id);
      if (remote) {
        void idbUpsertProject(remote).catch(() => undefined);
        return remote;
      }
    } catch {
      /* fall through */
    }
  }
  return idbGetProject(id);
}

/** Result of persisting a project (local always succeeds; team may fall back). */
export type UpsertResult = AtlasProject & {
  teamSync: "ok" | "local_only" | "local_fallback";
};

export async function upsertProject(project: AtlasProject): Promise<UpsertResult> {
  const local = await idbUpsertProject(project);
  if (await teamBackendReady()) {
    try {
      const remote = await teamUpsertProject(local);
      return { ...remote, teamSync: "ok" };
    } catch {
      return { ...local, teamSync: "local_fallback" };
    }
  }
  return { ...local, teamSync: "local_only" };
}

export async function deleteProject(id: string): Promise<void> {
  if (await teamBackendReady()) {
    try {
      await teamDeleteProject(id);
    } catch {
      /* still drop local copy */
    }
  }
  await idbDeleteProject(id);
}

export async function duplicateProject(
  id: string,
  copySuffix = "copy",
): Promise<AtlasProject> {
  const src = await getProject(id);
  if (!src) throw new Error("Project not found.");
  const copy = createEmptyProject({
    name: `${src.name} (${copySuffix})`,
    config: src.config,
    ...(src.description !== undefined ? { description: src.description } : {}),
    ...(src.yearFrom !== undefined ? { yearFrom: src.yearFrom } : {}),
    ...(src.yearTo !== undefined ? { yearTo: src.yearTo } : {}),
    ...(src.candidateIsos !== undefined ? { candidateIsos: src.candidateIsos } : {}),
    ...(src.notes !== undefined ? { notes: src.notes } : {}),
    ...(src.dataReleaseId !== undefined ? { dataReleaseId: src.dataReleaseId } : {}),
    ...(src.byodDefinitions !== undefined
      ? { byodDefinitions: src.byodDefinitions }
      : {}),
    ...(src.missingPolicyByVar !== undefined
      ? { missingPolicyByVar: src.missingPolicyByVar }
      : {}),
  });
  return upsertProject(copy);
}

/** Upload browser-local projects into the shared team library. */
export async function uploadLocalProjectsToTeam(): Promise<number> {
  if (!(await teamBackendReady())) return 0;
  const local = await idbListProjects();
  const full: AtlasProject[] = [];
  for (const item of local) {
    const p = await idbGetProject(item.id);
    if (p) full.push(p);
  }
  if (full.length === 0) return 0;
  const result = await teamMigrateLocal(full);
  return result.uploaded;
}

export async function libraryStatus(): Promise<
  ProjectLibraryStatus & { team: boolean }
> {
  const status = await getLibraryStatus();
  return { ...status, team: await teamBackendReady() };
}

export { getLibraryStatus };
export type { ProjectLibraryStatus };
