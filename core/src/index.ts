/** Package version — kept in sync with package.json for runtime checks. */
export const version = "0.1.0";

export {
  evidencePresent,
  gate,
  gateOne,
  type Deployment,
  type GateDecision,
  type GateResult,
  type GateVariable,
  type RightsEvidence,
  type SourceRights,
  type YesNoUnknown,
} from "./gate.js";
