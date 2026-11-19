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
