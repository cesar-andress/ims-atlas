import {
  AnalysisConfigSchema,
  DEFAULT_CONFIG,
  ViewIdSchema,
  type AnalysisConfig,
  type ViewId,
} from "./schema";

const PARAM = "c";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Compact JSON → URL-safe payload (UTF-8). */
export function encodeConfig(config: AnalysisConfig): string {
  const json = JSON.stringify(config);
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeConfig(payload: string): AnalysisConfig {
  const json = new TextDecoder().decode(fromBase64Url(payload));
  return AnalysisConfigSchema.parse(JSON.parse(json));
}

export function parseConfigFromSearch(search: string): AnalysisConfig {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = params.get(PARAM);
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    return decodeConfig(raw);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function configToSearch(config: AnalysisConfig): string {
  const compact: AnalysisConfig = { v: 1, view: config.view };
  if (config.origin) compact.origin = config.origin;
  if (config.year !== undefined) compact.year = config.year;
  if (config.hs) compact.hs = config.hs;
  if (config.region) compact.region = config.region;
  if (config.minImports !== undefined) compact.minImports = config.minImports;
  if (config.normalization) compact.normalization = config.normalization;
  if (config.mcdm) compact.mcdm = config.mcdm;
  if (config.weightScheme) compact.weightScheme = config.weightScheme;
  if (config.missingThreshold !== undefined) {
    compact.missingThreshold = config.missingThreshold;
  }
  if (config.variableIds?.length) compact.variableIds = config.variableIds;
  if (config.factorWeights && Object.keys(config.factorWeights).length > 0) {
    compact.factorWeights = config.factorWeights;
  }
  if (config.compareA) compact.compareA = config.compareA;
  if (config.compareB) compact.compareB = config.compareB;
  if (config.matrixCutoff) compact.matrixCutoff = config.matrixCutoff;
  if (config.matrixCutA !== undefined) compact.matrixCutA = config.matrixCutA;
  if (config.matrixCutF !== undefined) compact.matrixCutF = config.matrixCutF;
  if (config.clusterK !== undefined) compact.clusterK = config.clusterK;
  if (config.mapSeed !== undefined) compact.mapSeed = config.mapSeed;
  if (config.mapColor) compact.mapColor = config.mapColor;
  if (config.lang) compact.lang = config.lang;
  return `?${PARAM}=${encodeConfig(AnalysisConfigSchema.parse(compact))}`;
}

export function pathForView(view: ViewId): string {
  if (view === "home") return "/";
  return `/${view}`;
}

export function viewFromPath(pathname: string): ViewId {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/" || clean === "") return "home";
  const seg = clean.replace(/^\//, "").split("/")[0] ?? "home";
  const parsed = ViewIdSchema.safeParse(seg);
  return parsed.success ? parsed.data : "home";
}
