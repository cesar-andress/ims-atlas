/**
 * Project library: IndexedDB primary, localStorage fallback (single-slot + index).
 */

import {
  createEmptyProject,
  migrateToAtlasProject,
  parseAtlasProject,
  toListItem,
  type AtlasProject,
  type ProjectListItem,
} from "./projectModel";

const DB_NAME = "ims-atlas-projects";
const DB_VERSION = 1;
const STORE = "projects";
const LS_INDEX = "ims-atlas.projects.index.v2";
const LS_PREFIX = "ims-atlas.project.v2.";
const LS_LEGACY = "ims-atlas.project.v1";
const DRAFT_KEY = "ims-atlas.project.draft.v2";

export type ProjectStorageMode = "indexeddb" | "localStorage" | "memory";

export type ProjectLibraryStatus = {
  mode: ProjectStorageMode;
  persistent: boolean;
  warning?: string;
};

let memory = new Map<string, AtlasProject>();
let cachedMode: ProjectStorageMode | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

async function idbAll(): Promise<AtlasProject[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as unknown[]).map((r) => parseAtlasProject(r));
      resolve(rows);
    };
    req.onerror = () => reject(req.error ?? new Error("idb getAll failed"));
  });
}

async function idbPut(project: AtlasProject): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb put failed"));
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb delete failed"));
  });
}

function lsReadIndex(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_INDEX);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function lsWriteIndex(ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_INDEX, JSON.stringify(ids));
}

function lsGet(id: string): AtlasProject | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (!raw) return null;
    return parseAtlasProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

function lsPut(project: AtlasProject): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_PREFIX + project.id, JSON.stringify(project));
  const ids = lsReadIndex();
  if (!ids.includes(project.id)) lsWriteIndex([project.id, ...ids]);
}

function lsDelete(id: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(LS_PREFIX + id);
  lsWriteIndex(lsReadIndex().filter((x) => x !== id));
}

async function detectMode(): Promise<ProjectLibraryStatus> {
  if (cachedMode === "indexeddb") {
    return { mode: "indexeddb", persistent: true };
  }
  try {
    await openDb();
    cachedMode = "indexeddb";
    return { mode: "indexeddb", persistent: true };
  } catch {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("ims-atlas.projects.probe", "1");
        localStorage.removeItem("ims-atlas.projects.probe");
        cachedMode = "localStorage";
        return {
          mode: "localStorage",
          persistent: true,
          warning:
            "IndexedDB unavailable; projects are kept in localStorage (limited).",
        };
      } catch {
        /* fall through */
      }
    }
    cachedMode = "memory";
    return {
      mode: "memory",
      persistent: false,
      warning: "This browser does not keep projects; export to file (.atlas.json).",
    };
  }
}

/** One-time: lift legacy single-slot v1 into the library if empty. */
async function migrateLegacySlot(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const legacy = localStorage.getItem(LS_LEGACY);
  if (!legacy) return;
  try {
    const existing = await listProjects();
    if (existing.length > 0) return;
    const project = migrateToAtlasProject(JSON.parse(legacy));
    await upsertProject(project);
  } catch {
    /* ignore corrupt legacy */
  }
}

export async function getLibraryStatus(): Promise<ProjectLibraryStatus> {
  const status = await detectMode();
  await migrateLegacySlot();
  return status;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const status = await detectMode();
  let rows: AtlasProject[] = [];
  if (status.mode === "indexeddb") {
    try {
      rows = await idbAll();
    } catch {
      rows = [];
    }
  } else if (status.mode === "localStorage") {
    rows = lsReadIndex()
      .map((id) => lsGet(id))
      .filter((p): p is AtlasProject => p !== null);
  } else {
    rows = [...memory.values()];
  }
  return rows.map(toListItem).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<AtlasProject | null> {
  const status = await detectMode();
  if (status.mode === "indexeddb") {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => {
        resolve(req.result ? parseAtlasProject(req.result) : null);
      };
      req.onerror = () => reject(req.error ?? new Error("idb get failed"));
    });
  }
  if (status.mode === "localStorage") return lsGet(id);
  return memory.get(id) ?? null;
}

export async function upsertProject(project: AtlasProject): Promise<AtlasProject> {
  const parsed = parseAtlasProject(project);
  const status = await detectMode();
  if (status.mode === "indexeddb") await idbPut(parsed);
  else if (status.mode === "localStorage") lsPut(parsed);
  else memory.set(parsed.id, parsed);
  return parsed;
}

export async function deleteProject(id: string): Promise<void> {
  const status = await detectMode();
  if (status.mode === "indexeddb") await idbDelete(id);
  else if (status.mode === "localStorage") lsDelete(id);
  else memory.delete(id);
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

export function saveDraft(project: AtlasProject): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(project));
  } catch {
    /* quota */
  }
}

export function loadDraft(): AtlasProject | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return parseAtlasProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}

/** Test helper: reset in-memory mode. */
export function __resetProjectLibraryForTests(): void {
  memory = new Map();
  cachedMode = "memory";
}
