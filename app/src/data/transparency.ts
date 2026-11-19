/** Load Phase 7b transparency JSON from /status and /data/v… (no hand-written values). */

export type TransparencyIndex = {
  schema: string;
  paths: Record<string, string>;
  current_release: string;
  freshness_generated_at?: string | null;
  qa_status?: string | null;
  qa_n_warn?: number | null;
  qa_n_block?: number | null;
  latest_run_id?: string | null;
  latest_run_status?: string | null;
  n_sources?: number | null;
  n_variables?: number | null;
  n_lineage_edges?: number | null;
};

export type TransparencySource = {
  id: string;
  publisher?: string | null;
  landing_url?: string | null;
  terms_url?: string | null;
  licence_url?: string | null;
  update_cadence?: string | null;
  version_detection?: string | null;
  citation?: string | null;
  endpoints?: {
    id?: string | null;
    template?: string | null;
    method?: string | null;
    notes?: string | null;
  }[];
  rights?: Record<string, unknown>;
  freshness?: Record<string, unknown>;
  release_version?: string | null;
};

export type TransparencyVariable = {
  id: string;
  name?: { en?: string; es?: string } | string | null;
  factor?: string | null;
  direction?: string | null;
  status?: string | null;
  redistributable?: boolean | null;
  byod_only?: boolean | null;
  source_ids?: string[];
  years?: unknown;
  citation?: string | null;
  formula?: string | null;
  definition?: string | null;
  gate?: {
    decision?: string;
    included?: boolean;
    reasons?: string[];
    source_ids?: string[];
  } | null;
  coverage?: Record<string, Record<string, number>> | null;
  download_allowed?: boolean | null;
};

async function fetchJson<T>(path: string): Promise<T> {
  const base = import.meta.env.BASE_URL || "/";
  const url = path.startsWith("http")
    ? path
    : `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<TransparencyIndex> {
  return fetchJson("/status/index.json");
}

export function loadSources(): Promise<{ sources: TransparencySource[] }> {
  return fetchJson("/status/sources.json");
}

export function loadVariables(): Promise<{ variables: TransparencyVariable[] }> {
  return fetchJson("/status/variables.json");
}

export function loadFreshness(): Promise<Record<string, unknown>> {
  return fetchJson("/status/freshness.json");
}

export function loadQa(): Promise<Record<string, unknown>> {
  return fetchJson("/status/qa.json");
}

export function loadLineage(): Promise<{
  edges: { from: string; to: string }[];
  nodes?: unknown;
}> {
  return fetchJson("/status/lineage.json");
}

export function loadLatestRun(): Promise<Record<string, unknown>> {
  return fetchJson("/status/runs/latest.json");
}

export function loadReleases(): Promise<{
  current: string;
  releases: Record<string, unknown>[];
}> {
  return fetchJson("/status/releases.json");
}

export function loadManifest(path: string): Promise<Record<string, unknown>> {
  return fetchJson(path);
}

/** Collect every primitive string/number leaf for the “no hand-written numbers” check. */
export function collectLeaves(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (value === null || value === undefined) return out;
  if (typeof value === "number" || typeof value === "boolean") {
    out.add(String(value));
    return out;
  }
  if (typeof value === "string") {
    out.add(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLeaves(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectLeaves(v, out);
    }
  }
  return out;
}
