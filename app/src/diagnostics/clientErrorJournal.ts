/**
 * Client-side error journal for ops triage (not product analytics).
 *
 * Captures console.error / window errors / unhandled rejections into a
 * localStorage ring buffer. Team sessions may flush to
 * `/api/projects/client-errors` (Authelia). No BYOD payloads; URLs redacted.
 */

import { version as APP_VERSION } from "@ims-atlas/core";

export const CLIENT_ERROR_SCHEMA = 1 as const;
export const CLIENT_ERROR_STORAGE_KEY = "ims-atlas.clientErrorJournal.v1";
export const CLIENT_ERROR_MAX_EVENTS = 80;
export const CLIENT_ERROR_MAX_MESSAGE = 800;

export type ClientErrorSource =
  "console.error" | "console.warn" | "window.onerror" | "unhandledrejection" | "atlas";

export type ClientErrorEvent = {
  id: string;
  at: string;
  source: ClientErrorSource;
  message: string;
  stack?: string;
  href?: string;
  /** Fingerprint for dedupe (source + normalised message). */
  fingerprint: string;
  count: number;
  /** ISO time when last seen (if count > 1). */
  lastAt?: string;
  /** Flushed to team inbox (or marked after local export). */
  synced?: boolean;
};

export type ClientErrorExport = {
  schemaVersion: typeof CLIENT_ERROR_SCHEMA;
  kind: "ims-atlas-client-errors";
  exportedAt: string;
  appVersion: string;
  userAgent?: string;
  href?: string;
  events: ClientErrorEvent[];
};

type Store = {
  schemaVersion: typeof CLIENT_ERROR_SCHEMA;
  events: ClientErrorEvent[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Strip query/hash and obvious secrets from URLs / free text. */
export function redactSensitiveText(raw: string): string {
  let s = raw;
  // Full URLs → origin + path only
  s = s.replace(/https?:\/\/[^\s"'`]+/gi, (url) => {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return url.split("?")[0]!.split("#")[0]!;
    }
  });
  s = s.replace(
    /(?:authorization|api[_-]?key|token|password|secret|cookie)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[REDACTED]",
  );
  s = s.replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  if (s.length > CLIENT_ERROR_MAX_MESSAGE) {
    s = `${s.slice(0, CLIENT_ERROR_MAX_MESSAGE)}…`;
  }
  return s;
}

export function fingerprintError(source: ClientErrorSource, message: string): string {
  const norm = message
    .replace(/\b\d{4,}\b/g, "#")
    .replace(/0x[0-9a-f]+/gi, "0x#")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `${source}|${norm.slice(0, 240)}`;
}

function emptyStore(): Store {
  return { schemaVersion: CLIENT_ERROR_SCHEMA, events: [] };
}

function readStore(): Store {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(CLIENT_ERROR_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Store;
    if (
      !parsed ||
      parsed.schemaVersion !== CLIENT_ERROR_SCHEMA ||
      !Array.isArray(parsed.events)
    ) {
      return emptyStore();
    }
    return { schemaVersion: CLIENT_ERROR_SCHEMA, events: parsed.events };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLIENT_ERROR_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function argToMessage(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) {
        return a.message || a.name || "Error";
      }
      if (typeof a === "string") return a;
      if (a && typeof a === "object") {
        try {
          return JSON.stringify(a);
        } catch {
          return Object.prototype.toString.call(a);
        }
      }
      return String(a);
    })
    .join(" ")
    .trim();
}

/**
 * Record one client error. Dedupes by fingerprint; bumps count.
 * Returns the stored event (or null if message empty after redact).
 */
export function recordClientError(input: {
  source: ClientErrorSource;
  message: string;
  stack?: string;
  href?: string;
}): ClientErrorEvent | null {
  const message = redactSensitiveText(input.message);
  if (!message) return null;
  const fingerprint = fingerprintError(input.source, message);
  const store = readStore();
  const existing = store.events.find((e) => e.fingerprint === fingerprint);
  const at = nowIso();
  if (existing) {
    existing.count += 1;
    existing.lastAt = at;
    if (input.stack && !existing.stack) {
      existing.stack = redactSensitiveText(input.stack);
    }
    existing.synced = false;
    // Move to front
    store.events = [
      existing,
      ...store.events.filter((e) => e.id !== existing.id),
    ].slice(0, CLIENT_ERROR_MAX_EVENTS);
    writeStore(store);
    scheduleTeamFlush();
    return existing;
  }
  const event: ClientErrorEvent = {
    id: randomId(),
    at,
    source: input.source,
    message,
    fingerprint,
    count: 1,
  };
  if (input.stack) event.stack = redactSensitiveText(input.stack);
  const href =
    input.href ?? (typeof window !== "undefined" ? window.location.href : undefined);
  if (href) event.href = redactSensitiveText(href);
  store.events = [event, ...store.events].slice(0, CLIENT_ERROR_MAX_EVENTS);
  writeStore(store);
  scheduleTeamFlush();
  return event;
}

export function listClientErrors(): ClientErrorEvent[] {
  return [...readStore().events];
}

export function unsyncedClientErrors(): ClientErrorEvent[] {
  return readStore().events.filter((e) => !e.synced);
}

export function markClientErrorsSynced(ids: readonly string[]): void {
  if (!ids.length) return;
  const set = new Set(ids);
  const store = readStore();
  for (const e of store.events) {
    if (set.has(e.id)) e.synced = true;
  }
  writeStore(store);
}

export function clearClientErrors(): void {
  writeStore(emptyStore());
}

export function buildClientErrorExport(
  events?: readonly ClientErrorEvent[],
): ClientErrorExport {
  const list = events ? [...events] : listClientErrors();
  const out: ClientErrorExport = {
    schemaVersion: CLIENT_ERROR_SCHEMA,
    kind: "ims-atlas-client-errors",
    exportedAt: nowIso(),
    appVersion: APP_VERSION,
    events: list,
  };
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    out.userAgent = navigator.userAgent;
  }
  if (typeof window !== "undefined") {
    out.href = redactSensitiveText(window.location.href);
  }
  return out;
}

export function downloadClientErrorExport(filename?: string): ClientErrorExport {
  const payload = buildClientErrorExport();
  const name =
    filename ??
    `ims-atlas-client-errors-${payload.exportedAt.replace(/[:.]/g, "-")}.json`;
  if (typeof document !== "undefined") {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  markClientErrorsSynced(payload.events.map((e) => e.id));
  return payload;
}

const TEAM_FLUSH_URL = "/api/projects/client-errors";
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight = false;
let captureInstalled = false;

/** Debounced POST of unsynced events (team Authelia session only). */
export function scheduleTeamFlush(delayMs = 2500): void {
  if (typeof window === "undefined") return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushClientErrorsToTeam();
  }, delayMs);
}

export async function flushClientErrorsToTeam(): Promise<{
  ok: boolean;
  accepted: number;
  reason?: string;
}> {
  if (flushInFlight) return { ok: false, accepted: 0, reason: "busy" };
  const pending = unsyncedClientErrors();
  if (!pending.length) return { ok: true, accepted: 0 };
  flushInFlight = true;
  try {
    const body = buildClientErrorExport(pending);
    const res = await fetch(TEAM_FLUSH_URL, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, accepted: 0, reason: "auth" };
    }
    if (!res.ok) {
      return { ok: false, accepted: 0, reason: `http_${res.status}` };
    }
    const data = (await res.json()) as { accepted?: number };
    const accepted = Number(data.accepted ?? pending.length);
    markClientErrorsSynced(pending.map((e) => e.id));
    return { ok: true, accepted };
  } catch {
    return { ok: false, accepted: 0, reason: "network" };
  } finally {
    flushInFlight = false;
  }
}

/**
 * Install global console / window hooks once.
 * Safe to call multiple times (no-op after first).
 */
export function installClientErrorCapture(opts?: {
  /** Also capture console.warn (default false — noisy). */
  captureWarn?: boolean;
}): void {
  if (captureInstalled || typeof window === "undefined") return;
  captureInstalled = true;

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const message = argToMessage(args);
      const stack =
        args.find((a) => a instanceof Error)?.stack ??
        (typeof args[0] === "object" && args[0] && "stack" in (args[0] as object)
          ? String((args[0] as { stack?: unknown }).stack ?? "")
          : undefined);
      recordClientError({
        source: "console.error",
        message: message || "console.error",
        ...(stack ? { stack } : {}),
      });
    } catch {
      /* never break console */
    }
    origError(...args);
  };

  if (opts?.captureWarn) {
    const origWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      try {
        recordClientError({
          source: "console.warn",
          message: argToMessage(args) || "console.warn",
        });
      } catch {
        /* ignore */
      }
      origWarn(...args);
    };
  }

  window.addEventListener("error", (ev) => {
    const message =
      ev.message ||
      (ev.error instanceof Error ? ev.error.message : "") ||
      "window.onerror";
    const stack = ev.error instanceof Error ? ev.error.stack : undefined;
    recordClientError({
      source: "window.onerror",
      message,
      ...(stack ? { stack } : {}),
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : argToMessage([reason]) || "unhandledrejection";
    const stack = reason instanceof Error ? reason.stack : undefined;
    recordClientError({
      source: "unhandledrejection",
      message,
      ...(stack ? { stack } : {}),
    });
  });
}

/** Test helper. */
export function resetClientErrorJournalForTests(): void {
  captureInstalled = false;
  flushInFlight = false;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(CLIENT_ERROR_STORAGE_KEY);
  }
}
