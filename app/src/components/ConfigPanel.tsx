import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../i18n";
import { REGIONS } from "../data/hsProducts";
import { analysisErrorFromUnknown } from "../ranking/analysisError";
import { loadDemoPanel, type DemoPanel } from "../ranking/demoPanel";
import { prefetchRanking } from "../ranking/rankingCache";
import { rankingRequestFromConfig } from "../ranking/rankingRequest";
import { COL_HS64_PRESET, IMSFE_BAENA_CANO_PRESET } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisReady } from "../state/views";
import { ExpertSurveyPanel } from "./ExpertSurveyPanel";
import { HelpButton } from "./HelpButton";
import { PermalinkLink } from "./PermalinkLink";
import { PodiumPanel } from "./PodiumPanel";
import { ValueChartsPanel } from "./ValueChartsPanel";
import { WeightLifterPanel } from "./WeightLifterPanel";
import { LineUpWeightEditor } from "./LineUpWeightEditor";
import { GlossaryTooltip } from "./GlossaryTooltip";
import { BaciPreselectBanner } from "./BaciPreselectBanner";
import { RadixSelectField } from "./RadixSelectField";
import { VariablesRadixFields } from "./VariablesRadixFields";
import { ZeroPolicyCompare } from "./ZeroPolicyCompare";

/** Hide blocks when Variables guided mode is on a different step. */
function GuidedBlock({
  step,
  current = "all",
  children,
}: {
  step: number;
  current?: number | "all";
  children: ReactNode;
}) {
  if (current !== "all" && current !== step) return null;
  return <div data-guided-step={step}>{children}</div>;
}

const FACTOR_ORDER = [
  "demand",
  "cost_access",
  "logistics",
  "competition",
  "product_fit",
  "macro_risk",
  "institutional",
  "openness",
  "communication",
  "entrepreneurship",
  "sustainability",
  "promotion",
] as const;

type ConfigPanelProps = {
  /** `page` = Variables hub (full width). Default keeps legacy aside chrome. */
  layout?: "aside" | "page";
  /** Guided Variables stepper (0–4); `"all"` shows every block (expert / aside). */
  guidedStep?: number | "all";
};

export function ConfigPanel({
  layout = "aside",
  guidedStep = "all",
}: ConfigPanelProps) {
  const { t, i18n } = useTranslation();
  const {
    config,
    setConfig,
    replaceConfig,
    saveProject,
    exportProject,
    importProject,
  } = useAnalysis();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const [panel, setPanel] = useState<DemoPanel | null>(null);
  const [panelStatus, setPanelStatus] = useState<
    "loading" | "ready" | "pending" | "error"
  >("loading");
  const [panelDetail, setPanelDetail] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setPanelStatus("loading");
    void loadDemoPanel()
      .then((p) => {
        if (cancelled) return;
        setPanel(p);
        setPanelStatus("ready");
        setPanelDetail(undefined);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPanel(null);
        const mapped = analysisErrorFromUnknown(err);
        setPanelStatus(mapped.kind === "pending" ? "pending" : "error");
        setPanelDetail(mapped.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Warm ranking cache as soon as the demo panel is available.
  useEffect(() => {
    if (panelStatus !== "ready" || !isAnalysisReady(config)) return;
    prefetchRanking(rankingRequestFromConfig(config));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primitive ranking inputs only
  }, [
    panelStatus,
    config.origin,
    config.hs,
    config.year,
    config.region,
    config.minImports,
    config.variableIds,
    config.normalization,
    config.mcdm,
    config.weightScheme,
    config.missingThreshold,
    config.factorWeights,
  ]);

  const selectedVars = useMemo(() => {
    if (!panel) return new Set<string>();
    if (config.variableIds?.length) return new Set(config.variableIds);
    return new Set(panel.variables.map((v) => v.id));
  }, [panel, config.variableIds]);

  const factorWeights = useMemo(() => {
    if (config.factorWeights && Object.keys(config.factorWeights).length > 0) {
      return { ...config.factorWeights };
    }
    const equal = 1 / FACTOR_ORDER.length;
    return Object.fromEntries(FACTOR_ORDER.map((f) => [f, equal]));
  }, [config.factorWeights]);

  // Local slider draft: commit on pointer/key end so dragging does not re-rank every tick.
  const [draftWeights, setDraftWeights] = useState<Record<string, number> | null>(null);
  const draftWeightsRef = useRef(draftWeights);
  draftWeightsRef.current = draftWeights;
  const displayWeights = draftWeights ?? factorWeights;
  useEffect(() => {
    setDraftWeights(null);
  }, [config.factorWeights, config.weightScheme]);

  const [missingDraft, setMissingDraft] = useState(
    String(config.missingThreshold ?? 0.2),
  );
  const missingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setMissingDraft(String(config.missingThreshold ?? 0.2));
  }, [config.missingThreshold]);

  function normalizeWeights(next: Record<string, number>): Record<string, number> {
    const sum = Object.values(next).reduce((a, b) => a + b, 0);
    return sum > 0
      ? Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v / sum]))
      : next;
  }

  function commitWeights(next: Record<string, number>) {
    const norm = normalizeWeights(next);
    setDraftWeights(null);
    setConfig({ weightScheme: "manual", factorWeights: norm });
  }

  return (
    <div
      className={`config-panel${layout === "page" ? " config-panel-page" : ""}`}
      data-testid="config-panel"
      data-layout={layout}
    >
      <div className="config-panel-fold">
        <div className="config-panel-body">
          <div className="page-help-row">
            <HelpButton section="getting_started" />
          </div>
          <GuidedBlock step={0} current={guidedStep}>
            <button
              type="button"
              data-testid="apply-col-hs64"
              onClick={() =>
                replaceConfig({ ...COL_HS64_PRESET, view: config.view, lang })
              }
            >
              {t("presetColHs64")}
            </button>
            <button
              type="button"
              data-testid="apply-imsfe-baena-cano"
              onClick={() =>
                replaceConfig({
                  ...IMSFE_BAENA_CANO_PRESET,
                  view: config.view,
                  lang,
                })
              }
            >
              {t("presetImsfeBaenaCano")}
            </button>
          </GuidedBlock>

          <GuidedBlock step={4} current={guidedStep}>
            <RadixSelectField
              id="method-family"
              label={t("methodFamily")}
              testId="method-family"
              value={config.methodFamily ?? "imsfe_2025"}
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
              onChange={(value) => {
                const family = value as NonNullable<typeof config.methodFamily>;
                if (family === "panel_all") {
                  setConfig({
                    methodFamily: family,
                    normalization: config.normalization ?? "ratio_legacy",
                    weightScheme: "equal",
                    factorWeights: undefined,
                    variableIds: panel
                      ? panel.variables.map((v) => v.id)
                      : config.variableIds,
                  });
                  return;
                }
                setConfig({
                  methodFamily: family,
                  normalization:
                    family === "smi_2018"
                      ? "ratio_legacy"
                      : (config.normalization ?? "ratio_legacy"),
                  ...(family === "imsfe_2025" || family === "imsfem_2025_olive"
                    ? {
                        variableIds: undefined,
                        factorWeights: undefined,
                        weightScheme: "expert_mean" as const,
                      }
                    : { variableIds: undefined }),
                });
              }}
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                data-testid="order-by-weight"
                checked={config.orderByWeight === true}
                onChange={(e) => setConfig({ orderByWeight: e.target.checked })}
              />
              {t("orderByWeight")}
            </label>

            <details className="mt-2" data-testid="advanced-method-options">
              <summary>{t("advancedMethodOptions")}</summary>
              <RadixSelectField
                id="zero-policy"
                label={t("zeroPolicy")}
                testId="zero-policy"
                value={config.zeroPolicy ?? "epsilon"}
                options={[
                  { value: "epsilon", label: t("zeroPolicyEpsilon") },
                  { value: "minmax", label: t("zeroPolicyMinmax") },
                  { value: "rank", label: t("zeroPolicyRank") },
                  { value: "offset_ratio", label: t("zeroPolicyOffset") },
                ]}
                onChange={(value) =>
                  setConfig({
                    zeroPolicy: value as "epsilon" | "minmax" | "rank" | "offset_ratio",
                  })
                }
              />
              <ZeroPolicyCompare />
              {(config.zeroPolicy ?? "epsilon") === "epsilon" ? (
                <label>
                  {t("zeroEpsilon")}
                  <input
                    type="number"
                    step="any"
                    min={0}
                    data-testid="zero-epsilon"
                    value={config.zeroEpsilon ?? 0.1}
                    onChange={(e) => setConfig({ zeroEpsilon: Number(e.target.value) })}
                  />
                </label>
              ) : null}
              {config.zeroPolicy === "offset_ratio" ? (
                <label>
                  {t("zeroOffsetC")}
                  <input
                    type="number"
                    step="any"
                    min={0}
                    data-testid="zero-offset-c"
                    value={config.zeroOffsetC ?? 0.001}
                    onChange={(e) => setConfig({ zeroOffsetC: Number(e.target.value) })}
                  />
                </label>
              ) : null}
              <RadixSelectField
                id="cultural-distance-kind"
                label={t("culturalDistanceKind")}
                testId="cultural-distance-kind"
                value={config.culturalDistanceKind ?? "sum_of_sums"}
                options={[
                  { value: "sum_of_sums", label: t("cultureSumOfSums") },
                  { value: "sum_abs_diff", label: t("cultureSumAbs") },
                  { value: "kogut_singh", label: t("cultureKogutSingh") },
                ]}
                onChange={(value) =>
                  setConfig({
                    culturalDistanceKind: value as
                      "sum_of_sums" | "sum_abs_diff" | "kogut_singh",
                  })
                }
              />
              <p className="muted small">{t("culturalDistanceHint")}</p>
              <RadixSelectField
                id="imputation-method"
                label={t("imputationMethod")}
                testId="imputation-method"
                value={config.imputationMethod ?? "none"}
                options={[
                  { value: "none", label: t("imputationNone") },
                  { value: "locf", label: "LOCF" },
                  { value: "linear_interp", label: t("imputationLinear") },
                  { value: "log_linear_trend", label: t("imputationTrend") },
                  { value: "cross_section", label: t("imputationCross") },
                ]}
                onChange={(value) =>
                  setConfig({
                    imputationMethod: value as
                      | "none"
                      | "locf"
                      | "linear_interp"
                      | "log_linear_trend"
                      | "cross_section",
                  })
                }
              />
              <p className="muted small">{t("imputationHint")}</p>
              <VariablesRadixFields />
              <label>
                {t("combinedEocWeight")}
                <input
                  type="range"
                  min={0.3}
                  max={0.7}
                  step={0.1}
                  data-testid="combined-eoc-weight"
                  value={config.combinedEocWeight ?? 0.5}
                  onChange={(e) =>
                    setConfig({ combinedEocWeight: Number(e.target.value) })
                  }
                />
                <span className="muted small">
                  {Math.round((config.combinedEocWeight ?? 0.5) * 100)}/
                  {Math.round((1 - (config.combinedEocWeight ?? 0.5)) * 100)}
                </span>
              </label>
              <RadixSelectField
                id="combined-eoc-norm"
                label={t("combinedEocNorm")}
                testId="combined-eoc-norm"
                value={config.combinedEocNorm ?? "ratio_to_max"}
                options={[
                  { value: "ratio_to_max", label: t("eocNormRatio") },
                  { value: "times_5", label: t("eocNormTimes5") },
                ]}
                onChange={(value) =>
                  setConfig({
                    combinedEocNorm: value as "ratio_to_max" | "times_5",
                  })
                }
              />
              <RadixSelectField
                id="preselect-pick"
                label={t("preselectPick")}
                testId="preselect-pick"
                value={config.preselectPick ?? "imports"}
                options={[
                  { value: "imports", label: t("preselectPickImports") },
                  { value: "openness", label: t("preselectPickOpenness") },
                  { value: "union", label: t("preselectPickUnion") },
                ]}
                onChange={(value) =>
                  setConfig({
                    preselectPick: value as "imports" | "openness" | "union",
                  })
                }
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  data-testid="include-origin-preselect"
                  checked={config.includeOriginInPreselect === true}
                  onChange={(e) =>
                    setConfig({ includeOriginInPreselect: e.target.checked })
                  }
                />
                {t("includeOriginInPreselect")}
              </label>

              <fieldset data-testid="map-view-options">
                <legend>{t("mapViewOptions")}</legend>
                <label>
                  {t("mapProjection")}
                  <select
                    data-testid="map-projection"
                    value={config.mapProjection ?? "globe"}
                    onChange={(e) =>
                      setConfig({
                        mapProjection: e.target.value as "globe" | "mercator",
                      })
                    }
                  >
                    <option value="globe">{t("mapProjGlobe")}</option>
                    <option value="mercator">{t("mapProjFlat")}</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    data-testid="map-extrude"
                    checked={config.mapExtrude === true}
                    onChange={(e) => setConfig({ mapExtrude: e.target.checked })}
                  />
                  {t("mapExtrude3d")}
                </label>
                <label>
                  {t("clusterK")}
                  <input
                    type="number"
                    min={2}
                    max={8}
                    data-testid="cluster-k"
                    value={config.clusterK ?? 4}
                    onChange={(e) =>
                      setConfig({
                        clusterK: Math.max(2, Math.min(8, Number(e.target.value) || 4)),
                      })
                    }
                  />
                </label>
              </fieldset>

              <fieldset data-testid="backtest-options">
                <legend>{t("backtestOptions")}</legend>
                <label>
                  {t("backtestTarget")}
                  <select
                    data-testid="backtest-target"
                    value={config.backtestTarget ?? "intensive"}
                    onChange={(e) =>
                      setConfig({
                        backtestTarget: e.target.value as
                          "intensive" | "new_markets" | "growth",
                      })
                    }
                  >
                    <option value="intensive">intensive</option>
                    <option value="new_markets">new_markets</option>
                    <option value="growth">growth</option>
                  </select>
                </label>
                <label>
                  {t("backtestHorizon")}
                  <select
                    data-testid="backtest-horizon"
                    value={config.backtestHorizon ?? 1}
                    onChange={(e) =>
                      setConfig({
                        backtestHorizon: Number(e.target.value) === 3 ? 3 : 1,
                      })
                    }
                  >
                    <option value={1}>k=1</option>
                    <option value={3}>k=3</option>
                  </select>
                </label>
              </fieldset>
            </details>
          </GuidedBlock>

          <GuidedBlock step={1} current={guidedStep}>
            <BaciPreselectBanner />
            <RadixSelectField
              id="preselect-mode"
              label={t("preselectMode")}
              testId="preselect-mode"
              value={config.preselectMode ?? "top_n"}
              options={[
                { value: "top_n", label: "Top N" },
                { value: "cumulative_share", label: "Cumulative share" },
              ]}
              onChange={(value) =>
                setConfig({
                  preselectMode: value as "top_n" | "cumulative_share",
                })
              }
            />
            {(config.preselectMode ?? "top_n") === "top_n" ? (
              <label>
                {t("preselectTopN")}
                <input
                  type="number"
                  min={1}
                  max={250}
                  data-testid="preselect-top-n"
                  value={config.preselectTopN ?? 30}
                  onChange={(e) => setConfig({ preselectTopN: Number(e.target.value) })}
                />
              </label>
            ) : (
              <label>
                {t("preselectCumShare")}
                <input
                  type="number"
                  min={0.05}
                  max={1}
                  step={0.05}
                  data-testid="preselect-cum-share"
                  value={config.preselectCumShare ?? 0.8}
                  onChange={(e) =>
                    setConfig({ preselectCumShare: Number(e.target.value) })
                  }
                />
              </label>
            )}
          </GuidedBlock>

          <GuidedBlock step={1} current={guidedStep}>
            <label>
              {t("region")}
              <select
                value={config.region ?? "world"}
                data-testid="region-select"
                onChange={(e) => setConfig({ region: e.target.value })}
              >
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name[lang]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("minImports")}
              <input
                type="number"
                min={0}
                step={1000}
                value={config.minImports ?? ""}
                placeholder="0"
                onChange={(e) =>
                  setConfig({
                    minImports: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
          </GuidedBlock>

          <GuidedBlock step={2} current={guidedStep}>
            <fieldset className="var-fieldset" data-testid="variable-picker">
              <legend>{t("variables")}</legend>
              {panel ? (
                <>
                  <p className="var-picker-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      data-testid="var-picker-all"
                      onClick={() =>
                        setConfig({
                          methodFamily: "panel_all",
                          weightScheme: "equal",
                          factorWeights: undefined,
                          variableIds: panel.variables.map((v) => v.id),
                        })
                      }
                    >
                      {t("varsApplyAllPanel").replace(
                        "{n}",
                        String(panel.variables.length),
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      data-testid="var-picker-tree-reset"
                      onClick={() =>
                        setConfig({
                          methodFamily: "imsfe_2025",
                          weightScheme: "expert_mean",
                          factorWeights: undefined,
                          variableIds: undefined,
                        })
                      }
                    >
                      {t("varsResetTree")}
                    </button>
                  </p>
                  {FACTOR_ORDER.map((factor) => {
                    const vars = panel.variables.filter((v) => v.factor === factor);
                    if (vars.length === 0) return null;
                    return (
                      <div
                        key={factor}
                        className="factor-vars"
                        data-testid={`factor-group-${factor}`}
                      >
                        <strong>{factor}</strong>
                        {vars.map((v) => {
                          const cov = panel.coveragePct[v.id] ?? 0;
                          const checked = selectedVars.has(v.id);
                          return (
                            <label
                              key={v.id}
                              className="var-check"
                              data-testid={`var-${v.id}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(selectedVars);
                                  if (checked) next.delete(v.id);
                                  else next.add(v.id);
                                  const ids = [...next];
                                  const treeOnly =
                                    config.methodFamily === "imsfe_2025" ||
                                    config.methodFamily === "imsfem_2025_olive";
                                  setConfig({
                                    variableIds: ids,
                                    ...(treeOnly && ids.length > 0
                                      ? {
                                          methodFamily: "panel_all" as const,
                                          weightScheme: "equal" as const,
                                          factorWeights: undefined,
                                        }
                                      : {}),
                                  });
                                }}
                              />
                              <span>
                                {v.id}{" "}
                                <span className="muted">
                                  ({cov.toFixed(0)}% · {v.direction})
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              ) : panelStatus === "pending" ? (
                <div data-testid="config-panel-pending">
                  <p className="muted small">{t("dataReleasePending")}</p>
                  {panelDetail ? <p className="muted small">{panelDetail}</p> : null}
                  <p className="analysis-actions">
                    <PermalinkLink view="status">{t("nav.status")}</PermalinkLink>
                    {" · "}
                    <PermalinkLink view="catalog">{t("nav.catalog")}</PermalinkLink>
                  </p>
                </div>
              ) : panelStatus === "error" ? (
                <p className="error" role="alert" data-testid="config-panel-error">
                  {panelDetail ?? t("loading")}
                </p>
              ) : (
                <p className="muted" data-testid="config-panel-loading">
                  {t("loading")}
                </p>
              )}
            </fieldset>
          </GuidedBlock>

          <GuidedBlock step={3} current={guidedStep}>
            <label>
              {t("weightScheme")}
              <select
                value={config.weightScheme ?? "expert_mean"}
                data-testid="weight-scheme"
                onChange={(e) =>
                  setConfig({
                    weightScheme: e.target.value as typeof config.weightScheme,
                  })
                }
              >
                <option value="expert_mean" title="expert_mean">
                  {t("weightLabelExpert")}
                </option>
                <option value="equal" title="equal">
                  {t("weightLabelEqual")}
                </option>
                <option value="manual" title="manual">
                  {t("weightLabelManual")}
                </option>
                <option value="entropy" title="entropy">
                  {t("weightLabelEntropy")}
                </option>
                <option value="critic" title="critic">
                  {t("weightLabelCritic")}
                </option>
              </select>
            </label>

            <div className="strategy-presets" data-testid="strategy-presets">
              <p className="muted small m-0">{t("strategyPresetsIntro")}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-testid="preset-mass-consume"
                  onClick={() =>
                    setConfig({
                      weightScheme: "manual",
                      factorWeights: {
                        cost_access: 0.35,
                        logistics: 0.35,
                        demand: 0.15,
                        competition: 0.05,
                        product_fit: 0.05,
                        macro_risk: 0.025,
                        institutional: 0.025,
                      },
                    })
                  }
                >
                  {t("strategyMassConsume")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-testid="preset-perishables"
                  onClick={() =>
                    setConfig({
                      weightScheme: "manual",
                      factorWeights: {
                        logistics: 0.45,
                        cost_access: 0.2,
                        demand: 0.15,
                        product_fit: 0.1,
                        competition: 0.05,
                        macro_risk: 0.025,
                        institutional: 0.025,
                      },
                    })
                  }
                >
                  {t("strategyPerishables")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-testid="preset-sme-first"
                  onClick={() =>
                    setConfig({
                      weightScheme: "manual",
                      factorWeights: {
                        product_fit: 0.3,
                        institutional: 0.25,
                        cost_access: 0.15,
                        logistics: 0.15,
                        demand: 0.1,
                        competition: 0.025,
                        macro_risk: 0.025,
                      },
                    })
                  }
                >
                  {t("strategySmeFirst")}
                </button>
              </div>
            </div>

            {config.weightScheme === "manual" ? (
              <fieldset className="weight-sliders" data-testid="weight-sliders">
                <legend>{t("factorWeights")}</legend>
                {FACTOR_ORDER.map((f) => (
                  <label key={f}>
                    {f}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((displayWeights[f] ?? 0) * 100)}
                      onChange={(e) => {
                        const raw = Number(e.target.value) / 100;
                        const next = normalizeWeights({
                          ...displayWeights,
                          [f]: raw,
                        });
                        setDraftWeights(next);
                      }}
                      onPointerUp={() => {
                        if (draftWeightsRef.current) {
                          commitWeights(draftWeightsRef.current);
                        }
                      }}
                      onKeyUp={() => {
                        if (draftWeightsRef.current) {
                          commitWeights(draftWeightsRef.current);
                        }
                      }}
                      onBlur={() => {
                        if (draftWeightsRef.current) {
                          commitWeights(draftWeightsRef.current);
                        }
                      }}
                    />
                    <span className="muted small">
                      {((displayWeights[f] ?? 0) * 100).toFixed(0)}%
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            {(config.weightScheme === "expert_mean" ||
              config.methodFamily === "imsfe_2025" ||
              config.methodFamily === "imsfem_2025_olive") && <ExpertSurveyPanel />}

            <ValueChartsPanel />
            <LineUpWeightEditor />
            <WeightLifterPanel />
            <PodiumPanel />
          </GuidedBlock>

          <GuidedBlock step={4} current={guidedStep}>
            <label>
              <GlossaryTooltip
                label={t("normalization")}
                technical="normalization"
                glossaryId="glossary"
              />
              <select
                value={config.normalization ?? "minmax"}
                data-testid="normalization-select"
                onChange={(e) =>
                  setConfig({
                    normalization: e.target.value as typeof config.normalization,
                  })
                }
              >
                <option value="minmax" title="minmax">
                  {t("normLabelMinmax")}
                </option>
                <option value="ratio_legacy" title="ratio_legacy">
                  {t("normLabelRatio")}
                </option>
                <option value="zscore" title="zscore">
                  {t("normLabelZscore")}
                </option>
                <option value="robust_z" title="robust_z">
                  {t("normLabelRobustZ")}
                </option>
                <option value="rank" title="rank">
                  {t("normLabelRank")}
                </option>
                <option value="log_minmax" title="log_minmax">
                  {t("normLabelLogMinmax")}
                </option>
              </select>
            </label>
            <p className="muted small">
              <PermalinkLink view="norm_lab">{t("normLabOpen")}</PermalinkLink>
            </p>

            <label>
              <GlossaryTooltip
                label={t("method")}
                technical="mcdm"
                glossaryId="glossary"
              />
              <select
                value={config.mcdm ?? "wsm"}
                data-testid="mcdm-select"
                onChange={(e) =>
                  setConfig({
                    mcdm: e.target.value as typeof config.mcdm,
                  })
                }
              >
                <option value="wsm" title="wsm">
                  {t("methodLabelWsm")}
                </option>
                <option value="topsis" title="topsis">
                  {t("methodLabelTopsis")}
                </option>
                <option value="vikor" title="vikor">
                  {t("methodLabelVikor")}
                </option>
                <option value="promethee_ii" title="promethee_ii">
                  {t("methodLabelPromethee")}
                </option>
              </select>
            </label>

            <label>
              <span title={t("missingThreshold")}>{t("missingThresholdPlain")}</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={missingDraft}
                data-testid="missing-threshold"
                onChange={(e) => {
                  const text = e.target.value;
                  setMissingDraft(text);
                  if (missingTimer.current) clearTimeout(missingTimer.current);
                  missingTimer.current = setTimeout(() => {
                    setConfig({
                      missingThreshold: text === "" ? undefined : Number(text),
                    });
                  }, 200);
                }}
                onBlur={() => {
                  if (missingTimer.current) clearTimeout(missingTimer.current);
                  setConfig({
                    missingThreshold:
                      missingDraft === "" ? undefined : Number(missingDraft),
                  });
                }}
              />
            </label>

            <div className="config-actions">
              <button
                type="button"
                data-testid="save-project"
                onClick={() => void saveProject()}
              >
                {t("saveProject")}
              </button>
              <button
                type="button"
                data-testid="export-project"
                onClick={() => {
                  const blob = new Blob([exportProject()], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "project.atlas.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                {t("exportProject")}
              </button>
              <label className="file-import">
                {t("importProject")}
                <input
                  type="file"
                  accept="application/json,.json,.atlas.json"
                  data-testid="import-project"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      importProject(text);
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : String(err));
                    }
                  }}
                />
              </label>
              <PermalinkLink view="projects">{t("nav.projects")}</PermalinkLink>
            </div>
          </GuidedBlock>
        </div>
      </div>
    </div>
  );
}
