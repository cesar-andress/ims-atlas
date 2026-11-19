import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import {
  hsCategoryTree,
  hsLabel,
  REGIONS,
  searchHs,
  topImporterHints,
} from "../data/hsProducts";
import { searchOrigins } from "../data/iso3Exporters";
import { analysisErrorFromUnknown } from "../ranking/analysisError";
import { loadDemoPanel, type DemoPanel } from "../ranking/demoPanel";
import { prefetchRanking } from "../ranking/rankingCache";
import { rankingRequestFromConfig } from "../ranking/rankingRequest";
import { COL_HS64_PRESET, IMSFE_BAENA_CANO_PRESET } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisReady } from "../state/views";
import { HelpButton } from "./HelpButton";
import { PermalinkLink } from "./PermalinkLink";

const FACTOR_ORDER = [
  "demand",
  "cost_access",
  "logistics",
  "competition",
  "product_fit",
  "macro_risk",
  "institutional",
  "openness_legacy",
  "sustainability",
] as const;

export function ConfigPanel() {
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
  const [hsQuery, setHsQuery] = useState(config.hs ?? "");
  const [hsDraft, setHsDraft] = useState(config.hs ?? "");
  const [originDraft, setOriginDraft] = useState(config.origin ?? "");
  const [yearDraft, setYearDraft] = useState(
    config.year !== undefined ? String(config.year) : "",
  );
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

  // Keep local drafts in sync when permalink / preset changes config.
  useEffect(() => {
    setHsQuery(config.hs ?? "");
    setHsDraft(config.hs ?? "");
  }, [config.hs]);
  useEffect(() => {
    setOriginDraft(config.origin ?? "");
  }, [config.origin]);
  useEffect(() => {
    setYearDraft(config.year !== undefined ? String(config.year) : "");
  }, [config.year]);

  const hsHits = useMemo(() => searchHs(hsQuery, lang), [hsQuery, lang]);
  const importerHintIsos = useMemo(() => {
    const code = config.hs ?? hsQuery.trim();
    if (!code) return [];
    return topImporterHints(code);
  }, [config.hs, hsQuery]);
  const originHits = useMemo(
    () => searchOrigins(originDraft).slice(0, 12),
    [originDraft],
  );
  const hsTree = useMemo(() => hsCategoryTree(), []);

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
    <aside
      className="config-panel"
      data-testid="config-panel"
      aria-label={t("configPanel")}
    >
      <details className="config-panel-fold" open>
        <summary>
          <h2>{t("configPanel")}</h2>
        </summary>

        <div className="config-panel-body">
          <div className="page-help-row">
            <HelpButton section="getting_started" />
          </div>
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

          <label>
            {t("methodFamily")}
            <select
              data-testid="method-family"
              value={config.methodFamily ?? "imsfe_2025"}
              onChange={(e) =>
                setConfig({
                  methodFamily: e.target.value as
                    "imsfe_2025" | "imsfem_2025_olive" | "smi_2018" | "smi_2020",
                  normalization:
                    e.target.value === "smi_2018"
                      ? "ratio_legacy"
                      : (config.normalization ?? "ratio_legacy"),
                })
              }
            >
              <option value="imsfe_2025">IMSFE 2025 calzado (6×3, 0–10)</option>
              <option value="imsfem_2025_olive">
                IMSFEM 2025 aceite (7×3, + Sostenibilidad)
              </option>
              <option value="smi_2018">SMI 2018 (4×11, 0–5)</option>
              <option value="smi_2020">SMI 2020+ (5×23, AHP)</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="order-by-weight"
              checked={config.orderByWeight === true}
              onChange={(e) => setConfig({ orderByWeight: e.target.checked })}
            />
            {t("orderByWeight")}
          </label>

          <label>
            {t("preselectMode")}
            <select
              data-testid="preselect-mode"
              value={config.preselectMode ?? "top_n"}
              onChange={(e) =>
                setConfig({
                  preselectMode: e.target.value as "top_n" | "cumulative_share",
                })
              }
            >
              <option value="top_n">Top N</option>
              <option value="cumulative_share">Cumulative share</option>
            </select>
          </label>
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

          <label>
            {t("origin")}
            <input
              value={originDraft}
              maxLength={3}
              placeholder="COL"
              list="origin-iso3-list"
              data-testid="origin-input"
              onChange={(e) => setOriginDraft(e.target.value.toUpperCase().slice(0, 3))}
              onBlur={() =>
                setConfig({
                  origin: originDraft ? originDraft.slice(0, 3) : undefined,
                })
              }
            />
          </label>
          <datalist id="origin-iso3-list">
            {originHits.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="muted small" data-testid="origin-count">
            {t("originPool")}: {searchOrigins("").length}
          </p>
          {originHits.length > 0 && originDraft.length > 0 ? (
            <ul className="hs-hits" data-testid="origin-hits">
              {originHits.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    className={config.origin === c ? "active" : undefined}
                    onClick={() => {
                      setOriginDraft(c);
                      setConfig({ origin: c });
                    }}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <label>
            {t("product")}
            <input
              value={hsQuery}
              placeholder="64 / Footwear / 6403"
              data-testid="hs-search"
              onChange={(e) => setHsQuery(e.target.value)}
            />
          </label>
          {hsHits.length > 0 ? (
            <ul className="hs-hits" data-testid="hs-hits">
              {hsHits.slice(0, 10).map((p) => (
                <li key={p.code}>
                  <button
                    type="button"
                    className={config.hs === p.code ? "active" : undefined}
                    onClick={() => {
                      setConfig({ hs: p.code });
                      setHsQuery(p.code);
                      setHsDraft(p.code);
                    }}
                  >
                    {hsLabel(p.code, lang)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {importerHintIsos.length > 0 ? (
            <p className="muted small" data-testid="hs-importer-hints">
              {t("illustrativeImporters").replaceAll(
                "{list}",
                importerHintIsos.join(", "),
              )}
            </p>
          ) : null}
          <details className="hs-tree" data-testid="hs-category-tree">
            <summary>{t("hsCategoryTree")}</summary>
            <ul>
              {hsTree.map((node) => (
                <li key={node.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setConfig({ hs: node.code });
                      setHsQuery(node.code);
                      setHsDraft(node.code);
                    }}
                  >
                    {node.code} — {node.name[lang]}
                  </button>
                  {node.children.length > 0 ? (
                    <ul>
                      {node.children.map((ch) => (
                        <li key={ch.code}>
                          <button
                            type="button"
                            onClick={() => {
                              setConfig({ hs: ch.code });
                              setHsQuery(ch.code);
                              setHsDraft(ch.code);
                            }}
                          >
                            {ch.code} — {ch.name[lang]}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
          <label>
            HS2/HS4/HS6
            <input
              value={hsDraft}
              maxLength={6}
              data-testid="hs-input"
              onChange={(e) =>
                setHsDraft(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onBlur={() => {
                setConfig({ hs: hsDraft || undefined });
                setHsQuery(hsDraft);
              }}
            />
          </label>

          <label>
            {t("year")}
            <input
              type="number"
              value={yearDraft}
              placeholder="2023"
              data-testid="year-input"
              onChange={(e) => setYearDraft(e.target.value)}
              onBlur={() =>
                setConfig({
                  year: yearDraft ? Number(yearDraft) : undefined,
                })
              }
            />
          </label>

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

          <fieldset className="var-fieldset" data-testid="variable-picker">
            <legend>{t("variables")}</legend>
            {panel ? (
              FACTOR_ORDER.map((factor) => {
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
                              setConfig({ variableIds: [...next] });
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
              })
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

          <label>
            {t("normalization")}
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
                robust_z
              </option>
              <option value="rank" title="rank">
                rank
              </option>
              <option value="log_minmax" title="log_minmax">
                log_minmax
              </option>
            </select>
          </label>
          <p className="muted small">
            <PermalinkLink view="norm_lab">{t("normLabOpen")}</PermalinkLink>
          </p>

          <label>
            {t("method")}
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
        </div>
      </details>
    </aside>
  );
}
