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
  if (config.labSkew) compact.labSkew = config.labSkew;
  if (config.labOutlier) compact.labOutlier = config.labOutlier;
  if (config.labScale) compact.labScale = config.labScale;
  if (config.labCompareScale) compact.labCompareScale = config.labCompareScale;
  if (config.labReferenceSet) compact.labReferenceSet = config.labReferenceSet;
  if (config.labYearPooling) compact.labYearPooling = config.labYearPooling;
  if (config.labDecorrelate !== undefined) {
    compact.labDecorrelate = config.labDecorrelate;
  }
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
  if (config.matrixMode) compact.matrixMode = config.matrixMode;
  if (config.methodFamily) compact.methodFamily = config.methodFamily;
  if (config.orderByWeight !== undefined) {
    compact.orderByWeight = config.orderByWeight;
  }
  if (config.zeroPolicy) compact.zeroPolicy = config.zeroPolicy;
  if (config.zeroEpsilon !== undefined) compact.zeroEpsilon = config.zeroEpsilon;
  if (config.zeroOffsetC !== undefined) compact.zeroOffsetC = config.zeroOffsetC;
  if (config.culturalDistanceKind) {
    compact.culturalDistanceKind = config.culturalDistanceKind;
  }
  if (config.preselectMode) compact.preselectMode = config.preselectMode;
  if (config.preselectTopN !== undefined) {
    compact.preselectTopN = config.preselectTopN;
  }
  if (config.preselectCumShare !== undefined) {
    compact.preselectCumShare = config.preselectCumShare;
  }
  if (config.clusterK !== undefined) compact.clusterK = config.clusterK;
  if (config.mapSeed !== undefined) compact.mapSeed = config.mapSeed;
  if (config.mapColor) compact.mapColor = config.mapColor;
  if (config.mapMode) compact.mapMode = config.mapMode;
  if (config.mapProjection) compact.mapProjection = config.mapProjection;
  if (config.mapExtrude !== undefined) compact.mapExtrude = config.mapExtrude;
  if (config.mapOverlayVar) compact.mapOverlayVar = config.mapOverlayVar;
  if (config.backtestTarget) compact.backtestTarget = config.backtestTarget;
  if (config.backtestHorizon !== undefined) {
    compact.backtestHorizon = config.backtestHorizon;
  }
  if (config.lang) compact.lang = config.lang;
  if (config.focusVariable) compact.focusVariable = config.focusVariable;
  if (config.focusCountry) compact.focusCountry = config.focusCountry;
  if (config.exploreFactor) compact.exploreFactor = config.exploreFactor;
  if (config.exploreSource) compact.exploreSource = config.exploreSource;
  if (config.exploreLicence) compact.exploreLicence = config.exploreLicence;
  if (config.exploreYearFrom !== undefined) {
    compact.exploreYearFrom = config.exploreYearFrom;
  }
  if (config.exploreYearTo !== undefined) {
    compact.exploreYearTo = config.exploreYearTo;
  }
  if (config.exploreMinCoverage !== undefined) {
    compact.exploreMinCoverage = config.exploreMinCoverage;
  }
  if (config.explorePinned?.length) compact.explorePinned = config.explorePinned;
  if (config.scatterX) compact.scatterX = config.scatterX;
  if (config.scatterY) compact.scatterY = config.scatterY;
  if (config.expertMode !== undefined) compact.expertMode = config.expertMode;
  if (config.targetMarket) compact.targetMarket = config.targetMarket;
  if (config.reserveMarkets?.length) compact.reserveMarkets = config.reserveMarkets;
  if (config.whyTargetMarket) compact.whyTargetMarket = config.whyTargetMarket;
  if (config.pastedShopPrices) compact.pastedShopPrices = config.pastedShopPrices;
  if (config.incotermsMode) compact.incotermsMode = config.incotermsMode;
  if (config.selectedIncoterm) compact.selectedIncoterm = config.selectedIncoterm;
  return `?${PARAM}=${encodeConfig(AnalysisConfigSchema.parse(compact))}`;
}

export function pathForView(view: ViewId, focusVariable?: string): string {
  if (view === "home") return "/";
  if (view === "status") return "/status";
  if (view === "privacy") return "/privacidad";
  if (view === "data_sources") return "/data/sources";
  if (view === "data_pipeline") return "/data/pipeline";
  if (view === "data_releases") return "/data/releases";
  if (view === "data_updates") return "/data/updates";
  if (view === "data_variable") {
    const id = focusVariable && focusVariable.length > 0 ? focusVariable : "_";
    return `/data/variables/${id}`;
  }
  return `/${view}`;
}

export function viewFromPath(pathname: string): ViewId {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/" || clean === "") return "home";
  if (clean === "/status") return "status";
  if (clean === "/privacidad" || clean === "/privacy") return "privacy";
  if (clean === "/data/sources") return "data_sources";
  if (clean === "/data/pipeline") return "data_pipeline";
  if (clean === "/data/releases") return "data_releases";
  if (clean === "/data/updates") return "data_updates";
  if (clean.startsWith("/data/variables/")) return "data_variable";
  const seg = clean.replace(/^\//, "").split("/")[0] ?? "home";
  const parsed = ViewIdSchema.safeParse(seg);
  return parsed.success ? parsed.data : "home";
}

/** Extract /data/variables/:id when present. */
export function focusVariableFromPath(pathname: string): string | undefined {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const m = /^\/data\/variables\/([^/]+)$/.exec(clean);
  if (!m) return undefined;
  const id = m[1]!;
  if (id === "_") return undefined;
  return id;
}
