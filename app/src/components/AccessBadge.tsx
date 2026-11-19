import { useTranslation } from "../i18n";
import { resolveSourceStore, type StoreKind } from "../auth/accessStore";

type RightsRecord = Record<string, unknown>;

type SourceBadgeProps = {
  kind: "source";
  store?: StoreKind | null | undefined;
  rights?: RightsRecord | null | undefined;
};

type VariableBadgeProps = {
  kind: "variable";
  store?: StoreKind | null | undefined;
  rights?: RightsRecord | null | undefined;
  downloadAllowed?: boolean | null | undefined;
  gateIncluded?: boolean | null | undefined;
  gateDecision?: string | null | undefined;
  catalogHint?: boolean | undefined;
};

export type AccessBadgeProps = SourceBadgeProps | VariableBadgeProps;

function variableShipped(props: VariableBadgeProps): boolean {
  if (props.downloadAllowed === true) return true;
  if (props.gateIncluded === true) return true;
  const d = props.gateDecision;
  return d === "ship_raw" || d === "ship_derived";
}

export function AccessBadge(props: AccessBadgeProps) {
  const { t } = useTranslation();
  const store = resolveSourceStore(props.store ?? null, props.rights ?? null);
  const shipped = props.kind === "variable" ? variableShipped(props) : false;

  if (
    props.kind === "variable" &&
    props.catalogHint &&
    !shipped &&
    store === "cerrada"
  ) {
    return (
      <span className="access-hint muted small" data-testid="access-catalog-hint">
        {t("access.catalogTeamOnly")}
      </span>
    );
  }

  const open = props.kind === "source" ? store === "abierta" : shipped;
  const label = open ? t("access.badgeAbierta") : t("access.badgeCerrada");
  const testId = open ? "access-badge-abierta" : "access-badge-cerrada";

  return (
    <span
      className={`access-badge access-${open ? "abierta" : "cerrada"}`}
      data-testid={testId}
      title={store}
    >
      {label}
    </span>
  );
}
