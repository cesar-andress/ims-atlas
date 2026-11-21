import { useEffect, useState } from "react";
import { useTranslation } from "../i18n";
import type { DemoPanel } from "../ranking/demoPanel";
import { loadProjectPanel } from "../ranking/projectPanel";
import type { AnalysisConfig } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisReady } from "../state/views";
import { RadixSelectField } from "./RadixSelectField";

type FamilyId = NonNullable<AnalysisConfig["methodFamily"]>;

const FAMILY_VALUES: FamilyId[] = [
  "imsfe_2025",
  "imsfem_2025_olive",
  "smi_2018",
  "smi_2020",
  "panel_all",
];

function familyPatch(
  value: FamilyId,
  current: AnalysisConfig,
  panel: DemoPanel | null,
): Partial<AnalysisConfig> {
  const base: Partial<AnalysisConfig> = {
    methodFamily: value,
    normalization:
      value === "smi_2018" ? "ratio_legacy" : (current.normalization ?? "ratio_legacy"),
  };
  if (value === "panel_all") {
    return {
      ...base,
      weightScheme: "equal",
      factorWeights: undefined,
      variableIds: panel ? panel.variables.map((v) => v.id) : current.variableIds,
    };
  }
  if (value === "imsfe_2025" || value === "imsfem_2025_olive") {
    return {
      ...base,
      weightScheme: current.weightScheme ?? "expert_mean",
      variableIds: undefined,
      factorWeights: undefined,
    };
  }
  return {
    ...base,
    weightScheme: current.weightScheme ?? "equal",
    variableIds: undefined,
  };
}

/** Prominent method-family picker + one-click “all panel variables”. */
export function MethodFamilyBar() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const [panel, setPanel] = useState<DemoPanel | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isAnalysisReady(config)) {
      setPanel(null);
      return;
    }
    void loadProjectPanel({
      origin: config.origin,
      hs: config.hs,
      year: config.year,
    })
      .then((p) => {
        if (!cancelled) setPanel(p);
      })
      .catch(() => {
        if (!cancelled) setPanel(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope fields only
  }, [config.origin, config.hs, config.year]);

  const value = (config.methodFamily ?? "imsfe_2025") as FamilyId;
  const nPanel = panel?.variables.length ?? 0;

  return (
    <div className="method-family-bar" data-testid="method-family-bar">
      <RadixSelectField
        id="method-family-hub"
        label={t("methodFamily")}
        testId="method-family-hub"
        value={FAMILY_VALUES.includes(value) ? value : "imsfe_2025"}
        options={[
          {
            value: "imsfe_2025",
            label: t("methodFamilyImsfe"),
          },
          {
            value: "imsfem_2025_olive",
            label: t("methodFamilyImsfem"),
          },
          { value: "smi_2018", label: t("methodFamilySmi2018") },
          { value: "smi_2020", label: t("methodFamilySmi2020") },
          { value: "panel_all", label: t("methodFamilyPanelAll") },
        ]}
        onChange={(next) => {
          const id = next as FamilyId;
          setConfig(familyPatch(id, config, panel));
        }}
      />
      <div className="method-family-bar-actions">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="vars-apply-all-panel"
          disabled={!panel || nPanel === 0}
          onClick={() => setConfig(familyPatch("panel_all", config, panel))}
        >
          {t("varsApplyAllPanel").replace("{n}", String(nPanel || "…"))}
        </button>
        {config.methodFamily === "panel_all" && config.variableIds?.length ? (
          <p className="muted small" data-testid="vars-all-panel-hint">
            {t("varsAllPanelHint").replace("{n}", String(config.variableIds.length))}
          </p>
        ) : null}
      </div>
    </div>
  );
}
