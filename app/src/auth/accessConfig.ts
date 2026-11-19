/** Deployment access mirror (`public/config/access.json` ← `config/deployment.yaml`). */

export type AccessMode = "ABIERTO" | "CERRADO";

export type AccessConfig = {
  access_mode: AccessMode;
  admin_mailto: string;
  auth: {
    portal_url: string;
    whoami_path: string;
    cerrada_base_path: string;
  };
};

let cached: AccessConfig | null = null;

function configUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/config/access.json`;
}

export async function loadAccessConfig(): Promise<AccessConfig> {
  if (cached) return cached;
  const res = await fetch(configUrl(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load access config (${res.status})`);
  }
  const data = (await res.json()) as AccessConfig;
  cached = data;
  return data;
}

export function atlasHomeUrl(): string {
  if (typeof window === "undefined") return "/";
  const base = import.meta.env.BASE_URL || "/";
  const path = base.endsWith("/") ? base : `${base}/`;
  return new URL(path, window.location.origin).href;
}
