import { useEffect, useState } from "react";
import { loadCatalogPreview } from "../data/catalogLoader";
import { useTranslation } from "../i18n";
import type { DemoPanel } from "../ranking/demoPanel";
import { loadProjectPanel } from "../ranking/projectPanel";
import type { AnalysisConfig } from "../state/schema";
import { equalFactorWeights } from "../state/projectScope";
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

type VarSource = {
  ids: string[];
  factors: string[];
};

function familyPatch(
  value: FamilyId,
  current: AnalysisConfig,
  source: VarSource | null,
): Partial<AnalysisConfig> {
  const base: Partial<AnalysisConfig> = {
    methodFamily: value,
    normalization:
      value === "smi_2018" ? "ratio_legacy" : (current.normalization ?? "ratio_legacy"),
  };
  if (value === "panel_all") {
    const ids = source?.ids.length ? source.ids : current.variableIds;
    const factors = source?.factors.length ? source.factors : [];
    return {
      ...base,
      weightScheme: "equal",
      factorWeights: factors.length ? equalFactorWeights(factors) : undefined,
      variableIds: ids,
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

function sourceFromPanel(panel: DemoPanel): VarSource {
  const ids = panel.variables.map((v) => v.id);
  const factors = [...new Set(panel.variables.map((v) => v.factor))];
  return { ids, factors };
}

/** Prominent method-family picker + one-click “all panel variables”. */
export function MethodFamilyBar() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const [panel, setPanel] = useState<DemoPanel | null>(null);
  const [catalog, setCatalog] = useState<VarSource | null>(null);

  const ready = isAnalysisReady(config);

  // Product panel when origin · HS · year are set.
  useEffect(() => {
    let cancelled = false;
    if (!ready) {
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
  }, [config.origin, config.hs, config.year, ready]);

  // Catalogue fallback so “all panel variables” is visible before scope is complete.
  useEffect(() => {
    let cancelled = false;
    void loadCatalogPreview()
      .then((c) => {
        if (cancelled || c.variables.length === 0) return;
        const factors = [
          ...new Set(c.factors.length ? c.factors : c.variables.map((v) => v.factor)),
        ];
        setCatalog({ ids: c.variables.map((v) => v.id), factors });
      })
      .catch(() => {
        if (!cancelled) setCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = (config.methodFamily ?? "imsfe_2025") as FamilyId;
  const liveSource = panel ? sourceFromPanel(panel) : catalog;
  const nPanel = liveSource?.ids.length ?? 0;
  const canApply = Boolean(liveSource && nPanel > 0);

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
          setConfig(familyPatch(id, config, liveSource));
        }}
      />
      <div className="method-family-bar-actions">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="vars-apply-all-panel"
          disabled={!canApply}
          onClick={() => setConfig(familyPatch("panel_all", config, liveSource))}
        >
          {t("varsApplyAllPanel").replace("{n}", String(nPanel || "…"))}
        </button>
        {config.methodFamily === "panel_all" && config.variableIds?.length ? (
          <p className="muted small" data-testid="vars-all-panel-hint">
            {t("varsAllPanelHint").replace("{n}", String(config.variableIds.length))}
            {!ready ? ` ${t("varsPanelAllBeforeScope")}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
