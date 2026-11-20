/**
 * Team project library client (PLAN §2ter). Talks to /api/projects behind Authelia.
 */

import {
  parseAtlasProject,
  type AtlasProject,
  type ProjectListItem,
} from "./projectModel";

const API_BASE = "/api/projects";

export type TeamProjectListItem = ProjectListItem & {
  createdBy?: string;
  updatedBy?: string;
  source?: "team";
};

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

function errorMessage(res: Response, body: unknown): string {
  if (body !== null && typeof body === "object" && "error" in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) return err;
  }
  return `Team projects API HTTP ${res.status}`;
}

export async function teamApiAvailable(): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data: unknown = await res.json();
    return (
      data !== null &&
      typeof data === "object" &&
      (data as { ok?: unknown }).ok === true
    );
  } catch {
    return false;
  }
}

export async function teamListProjects(): Promise<TeamProjectListItem[]> {
  const res = await apiFetch(API_BASE);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(res, body));
  if (!Array.isArray(body)) throw new Error("Invalid team project list.");
  return body.map((row) => {
    if (row === null || typeof row !== "object") {
      throw new Error("Invalid team project list item.");
    }
    const r = row as Record<string, unknown>;
    const item: TeamProjectListItem = {
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      createdAt: String(r.createdAt ?? ""),
      updatedAt: String(r.updatedAt ?? ""),
      source: "team",
    };
    if (typeof r.origin === "string") item.origin = r.origin;
    if (typeof r.hs === "string") item.hs = r.hs;
    if (typeof r.yearFrom === "number") item.yearFrom = r.yearFrom;
    if (typeof r.yearTo === "number") item.yearTo = r.yearTo;
    if (r.isExample === true) item.isExample = true;
    if (typeof r.createdBy === "string") item.createdBy = r.createdBy;
    if (typeof r.updatedBy === "string") item.updatedBy = r.updatedBy;
    return item;
  });
}

export async function teamGetProject(id: string): Promise<AtlasProject | null> {
  const res = await apiFetch(`${API_BASE}/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(res, body));
  if (body !== null && typeof body === "object" && "_meta" in body) {
    const clone = { ...(body as Record<string, unknown>) };
    delete clone._meta;
    return parseAtlasProject(clone);
  }
  return parseAtlasProject(body);
}

export async function teamUpsertProject(project: AtlasProject): Promise<AtlasProject> {
  const res = await apiFetch(`${API_BASE}/${encodeURIComponent(project.id)}`, {
    method: "PUT",
    body: JSON.stringify(project),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(res, body));
  return parseAtlasProject(body);
}

export async function teamDeleteProject(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (res.status === 404) return;
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(res, body));
}

export async function teamMigrateLocal(
  projects: AtlasProject[],
): Promise<{ uploaded: number; projects: TeamProjectListItem[] }> {
  const res = await apiFetch(`${API_BASE}/migrate-local`, {
    method: "POST",
    body: JSON.stringify({ projects }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(res, body));
  if (body === null || typeof body !== "object") {
    throw new Error("Invalid migrate-local response.");
  }
  const uploaded = Number((body as { uploaded?: unknown }).uploaded ?? 0);
  const list = await teamListProjects();
  return { uploaded, projects: list };
}
