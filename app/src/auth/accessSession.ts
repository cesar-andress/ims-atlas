import { useCallback, useEffect, useRef, useState } from "react";
import { loadAccessConfig } from "./accessConfig";

export type WhoAmIUser = {
  user: string;
  name: string;
  groups: string[];
};

export type AccessSessionStatus = "loading" | "anonymous" | "authenticated";

export type AccessSessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; profile: WhoAmIUser };

async function fetchWhoAmI(whoamiPath: string): Promise<AccessSessionState> {
  const base = import.meta.env.BASE_URL || "/";
  const url = whoamiPath.startsWith("http")
    ? whoamiPath
    : `${base.replace(/\/$/, "")}${whoamiPath.startsWith("/") ? whoamiPath : `/${whoamiPath}`}`;
  try {
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      redirect: "manual",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
    });
    if (
      res.type === "opaqueredirect" ||
      res.status === 401 ||
      res.status === 403 ||
      !res.ok
    ) {
      return { status: "anonymous" };
    }
    const data: unknown = await res.json();
    if (data !== null && typeof data === "object") {
      const rec = data as Record<string, unknown>;
      const userRaw = rec.user ?? rec.username;
      const nameRaw = rec.name ?? rec.displayname ?? rec.display_name ?? userRaw;
      if (
        typeof userRaw === "string" &&
        userRaw.trim() &&
        typeof nameRaw === "string"
      ) {
        let groups: string[] = [];
        if (Array.isArray(rec.groups)) {
          groups = rec.groups.filter((g): g is string => typeof g === "string");
        } else if (typeof rec.groups === "string" && rec.groups.trim()) {
          groups = rec.groups
            .split(/[, ]+/)
            .map((g) => g.trim())
            .filter(Boolean);
        }
        return {
          status: "authenticated",
          profile: { user: userRaw.trim(), name: nameRaw.trim(), groups },
        };
      }
    }
    return { status: "anonymous" };
  } catch {
    return { status: "anonymous" };
  }
}

export type UseAccessSessionResult = {
  status: AccessSessionStatus;
  profile: WhoAmIUser | undefined;
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
  refresh: () => Promise<void>;
};

export function useAccessSession(): UseAccessSessionResult {
  const [state, setState] = useState<AccessSessionState>({ status: "loading" });
  const [sessionExpired, setSessionExpired] = useState(false);
  const wasAuthenticated = useRef(false);
  const whoamiPathRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    let path = whoamiPathRef.current;
    if (!path) {
      const cfg = await loadAccessConfig();
      whoamiPathRef.current = cfg.auth.whoami_path;
      path = cfg.auth.whoami_path;
    }
    const next = await fetchWhoAmI(path);
    if (wasAuthenticated.current && next.status === "anonymous") {
      setSessionExpired(true);
    }
    wasAuthenticated.current = next.status === "authenticated";
    setState(next);
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const status: AccessSessionStatus =
    state.status === "loading"
      ? "loading"
      : state.status === "authenticated"
        ? "authenticated"
        : "anonymous";

  const profile = state.status === "authenticated" ? state.profile : undefined;

  return {
    status,
    profile,
    sessionExpired,
    dismissSessionExpired: () => setSessionExpired(false),
    refresh,
  };
}
