import dataJson from "../../config/data.json";

export type DataConfig = {
  release_version: string;
  release_base_path: string;
};

export const dataConfig: DataConfig = {
  release_version: dataJson.release_version,
  release_base_path: dataJson.release_base_path,
};

/** Absolute path prefix for the published SPEC §3 release, e.g. /data/v0.1.0 */
export function releaseUrl(path = ""): string {
  const base = `${dataConfig.release_base_path}/v${dataConfig.release_version}`;
  if (!path) return base;
  return `${base}/${path.replace(/^\//, "")}`;
}

let publicBaseCache: { at: number; base: string } | null = null;
const PUBLIC_BASE_TTL_MS = 60_000;

/** Test helper. */
export function resetPublicReleaseBaseCache(): void {
  publicBaseCache = null;
}

/**
 * Resolve a **reachable** public release base (`/data/vX.Y.Z`).
 * Prefers live `/data/CURRENT`, then config; skips versions whose
 * `country_year.parquet` 404s (stale config after a partial bump).
 */
export async function resolvePublicReleaseBase(): Promise<string> {
  const now = Date.now();
  if (publicBaseCache && now - publicBaseCache.at < PUBLIC_BASE_TTL_MS) {
    return publicBaseCache.base;
  }

  const versions: string[] = [];
  try {
    const res = await fetch(`${dataConfig.release_base_path}/CURRENT`, {
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const text = (await res.text()).trim().replace(/^v/, "");
      if (/^\d+\.\d+\.\d+$/.test(text)) versions.push(text);
    }
  } catch {
    /* ignore */
  }
  versions.push(dataConfig.release_version);
  // Known last-good public pin when CURRENT was bumped ahead of promote.
  if (!versions.includes("1.1.0")) versions.push("1.1.0");

  const seen = new Set<string>();
  for (const ver of versions) {
    if (seen.has(ver)) continue;
    seen.add(ver);
    const base = `${dataConfig.release_base_path}/v${ver}`;
    try {
      const url = `${base}/country_year.parquet`;
      let probe = await fetch(url, {
        method: "HEAD",
        credentials: "include",
        cache: "no-store",
      });
      if (!probe.ok) {
        // Some static hosts omit HEAD; 1-byte range is enough to reject 404 HTML.
        probe = await fetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Range: "bytes=0-3" },
        });
      }
      if (probe.ok || probe.status === 206) {
        publicBaseCache = { at: now, base };
        return base;
      }
    } catch {
      /* try next */
    }
  }

  const fallback = releaseUrl();
  publicBaseCache = { at: now, base: fallback };
  return fallback;
}
