/**
 * Persist last active project id across full page reload (F5).
 * localStorage primary; cookie backup when storage is slow/blocked.
 */

export const ACTIVE_PROJECT_ID_KEY = "ims-atlas.activeProjectId.v1";
export const ACTIVE_PROJECT_COOKIE = "ims_atlas_active_project";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 180; // 180 days

function cookieSafeId(id: string): boolean {
  return /^[A-Za-z0-9._:-]{1,120}$/.test(id);
}

export function writeActiveProjectId(id: string | null): void {
  if (typeof document === "undefined") return;
  if (!id) {
    try {
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    } catch {
      /* ignore */
    }
    document.cookie = `${ACTIVE_PROJECT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  if (!cookieSafeId(id)) return;
  try {
    localStorage.setItem(ACTIVE_PROJECT_ID_KEY, id);
  } catch {
    /* quota / private mode */
  }
  document.cookie = `${ACTIVE_PROJECT_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

export function readActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
    if (fromLs && cookieSafeId(fromLs)) return fromLs;
  } catch {
    /* ignore */
  }
  try {
    const match = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${ACTIVE_PROJECT_COOKIE}=`));
    if (!match) return null;
    const raw = decodeURIComponent(match.slice(ACTIVE_PROJECT_COOKIE.length + 1));
    return cookieSafeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Test helper. */
export function clearActiveProjectIdForTests(): void {
  writeActiveProjectId(null);
}
