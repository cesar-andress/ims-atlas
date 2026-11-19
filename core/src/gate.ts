/** Licence gate (SPEC §10.2). Pure function; mirrored in etl gate.py. */

export type YesNoUnknown = "yes" | "no" | "unknown";
export type GateDecision = "ship_raw" | "ship_derived" | "byod_only" | "local_only";

export type RightsEvidence = {
  checked_by?: string | null;
  checked_on?: string | null;
  terms_url?: string | null;
  snapshot_sha256?: string | null;
  note?: string;
};

export type SourceRights = {
  licence_id?: string;
  use_research?: YesNoUnknown;
  redistribute_raw?: YesNoUnknown;
  redistribute_derived?: YesNoUnknown;
  commercial_use?: YesNoUnknown;
  attribution_required?: YesNoUnknown;
  share_alike?: YesNoUnknown;
  no_derivatives?: YesNoUnknown;
  evidence?: RightsEvidence;
  [key: string]: unknown;
};

export type GateVariable = {
  rights?: SourceRights & { override_reason?: string };
  [key: string]: unknown;
};

export type Deployment = {
  commercial_context?: boolean;
  [key: string]: unknown;
};

export type GateResult = {
  decision: GateDecision;
  reasons: string[];
  share_alike: boolean;
};

const RIGHTS_FLAGS = [
  "use_research",
  "redistribute_raw",
  "redistribute_derived",
  "commercial_use",
  "attribution_required",
  "share_alike",
  "no_derivatives",
] as const;

const DECISION_RANK: Record<GateDecision, number> = {
  local_only: 0,
  byod_only: 1,
  ship_derived: 2,
  ship_raw: 3,
};

export function evidencePresent(rights: SourceRights): boolean {
  const evidence = rights.evidence;
  if (!evidence || typeof evidence !== "object") return false;
  const checkedBy = evidence.checked_by;
  const checkedOn = evidence.checked_on;
  const termsUrl = evidence.terms_url;
  const snapshot = evidence.snapshot_sha256;
  return (
    typeof checkedBy === "string" &&
    checkedBy.trim().length > 0 &&
    typeof checkedOn === "string" &&
    checkedOn.trim().length > 0 &&
    typeof termsUrl === "string" &&
    termsUrl.trim().length > 0 &&
    typeof snapshot === "string" &&
    snapshot.trim().length > 0
  );
}

function flag(rights: SourceRights, key: (typeof RIGHTS_FLAGS)[number]): YesNoUnknown {
  const value = rights[key];
  if (value === "yes" || value === "no" || value === "unknown") return value;
  return "unknown";
}

function commercialOk(rights: SourceRights, deployment: Deployment): boolean {
  const commercialUse = flag(rights, "commercial_use");
  const commercialContext = deployment.commercial_context !== false;
  if (commercialUse === "yes") return true;
  if (!commercialContext) return true;
  return false;
}

function mergeVariableOverride(
  sourceRights: SourceRights,
  variable: GateVariable | null | undefined,
): SourceRights {
  if (!variable?.rights || typeof variable.rights !== "object") {
    return { ...sourceRights };
  }
  const reason = variable.rights.override_reason;
  if (typeof reason !== "string" || !reason.trim()) {
    return { ...sourceRights };
  }
  const merged: SourceRights = { ...sourceRights };
  for (const [key, value] of Object.entries(variable.rights)) {
    if (key === "override_reason") continue;
    if (key === "evidence" && value && typeof value === "object") {
      merged.evidence = {
        ...(merged.evidence ?? {}),
        ...(value as RightsEvidence),
      };
    } else {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function gateOne(
  sourceRights: SourceRights,
  variable: GateVariable | null | undefined,
  deployment: Deployment,
): GateResult {
  const rights = mergeVariableOverride(sourceRights, variable);
  const reasons: string[] = [];

  const unknowns = RIGHTS_FLAGS.filter((name) => flag(rights, name) === "unknown");
  if (unknowns.length > 0) {
    reasons.push(`unknown rights: ${unknowns.join(", ")}`);
  }

  if (!evidencePresent(rights)) {
    reasons.push("evidence incomplete (checked_by/on, terms_url, snapshot_sha256)");
  }

  const useResearch = flag(rights, "use_research");
  if (useResearch === "no") {
    reasons.push("use_research=no");
    return {
      decision: "local_only",
      reasons,
      share_alike: flag(rights, "share_alike") === "yes",
    };
  }

  if (unknowns.length > 0 || !evidencePresent(rights)) {
    return {
      decision: "byod_only",
      reasons,
      share_alike: flag(rights, "share_alike") === "yes",
    };
  }

  if (!commercialOk(rights, deployment)) {
    reasons.push("commercial_use=no under commercial_context=true");
    return {
      decision: "byod_only",
      reasons,
      share_alike: flag(rights, "share_alike") === "yes",
    };
  }

  const rawOk = flag(rights, "redistribute_raw") === "yes";
  const derivedFlag = flag(rights, "redistribute_derived");
  const noDerivatives = flag(rights, "no_derivatives") === "yes";
  const derivedOk = (derivedFlag === "yes" || rawOk) && !noDerivatives;

  if (noDerivatives && derivedFlag === "yes") {
    reasons.push("no_derivatives=yes blocks ship_derived");
  }

  if (rawOk) {
    reasons.push("redistribute_raw=yes with evidence and commercial ok");
    return {
      decision: "ship_raw",
      reasons,
      share_alike: flag(rights, "share_alike") === "yes",
    };
  }

  if (derivedOk) {
    reasons.push("redistribute_derived allowed with evidence and commercial ok");
    return {
      decision: "ship_derived",
      reasons,
      share_alike: flag(rights, "share_alike") === "yes",
    };
  }

  if (flag(rights, "redistribute_raw") === "no") {
    reasons.push("redistribute_raw=no");
  }
  if (derivedFlag === "no" || noDerivatives) {
    reasons.push("derived redistribution not allowed");
  }

  return {
    decision: "byod_only",
    reasons: reasons.length > 0 ? reasons : ["redistribution not permitted"],
    share_alike: flag(rights, "share_alike") === "yes",
  };
}

export function gate(
  sourceRights: SourceRights | SourceRights[],
  variable: GateVariable | null | undefined,
  deployment: Deployment,
): GateResult {
  const records = Array.isArray(sourceRights) ? sourceRights : [sourceRights];
  if (records.length === 0) {
    return {
      decision: "byod_only",
      reasons: ["no source rights provided"],
      share_alike: false,
    };
  }

  const results = records.map((r) => gateOne(r, variable, deployment));
  let worst = results[0]!;
  for (const result of results) {
    if (DECISION_RANK[result.decision] < DECISION_RANK[worst.decision]) {
      worst = result;
    }
  }

  const reasons: string[] = [];
  for (let index = 0; index < results.length; index += 1) {
    const prefix = results.length > 1 ? `source[${index}]` : "";
    for (const reason of results[index]!.reasons) {
      reasons.push(prefix ? `${prefix}: ${reason}` : reason);
    }
  }

  return {
    decision: worst.decision,
    reasons,
    share_alike: results.some((r) => r.share_alike),
  };
}
