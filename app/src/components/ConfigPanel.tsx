import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { hsLabel, REGIONS, searchHs } from "../data/hsProducts";
import { loadDemoPanel, type DemoPanel } from "../ranking/demoPanel";
import { COL_HS64_PRESET } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";

const FACTOR_ORDER = [
  "demand",
  "cost_access",
  "logistics",
  "competition",
  "product_fit",
  "macro_risk",
  "institutional",
  "openness_legacy",
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

  useEffect(() => {
    void loadDemoPanel()
      .then(setPanel)
      .catch(() => setPanel(null));
  }, []);

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
          <button
            type="button"
            data-testid="apply-col-hs64"
            onClick={() =>
              replaceConfig({ ...COL_HS64_PRESET, view: config.view, lang })
            }
          >
            {t("presetColHs64")}
          </button>

          <label>
            {t("origin")}
            <input
              value={originDraft}
              maxLength={3}
              placeholder="COL"
              data-testid="origin-input"
              onChange={(e) => setOriginDraft(e.target.value.toUpperCase().slice(0, 3))}
              onBlur={() =>
                setConfig({
                  origin: originDraft ? originDraft.slice(0, 3) : undefined,
                })
              }
            />
          </label>

          <label>
            {t("product")}
            <input
              value={hsQuery}
              placeholder="64 / Footwear"
              data-testid="hs-search"
              onChange={(e) => setHsQuery(e.target.value)}
            />
          </label>
          {hsHits.length > 0 ? (
            <ul className="hs-hits" data-testid="hs-hits">
              {hsHits.slice(0, 8).map((p) => (
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
          {config.hs && config.hs.length > 2 ? (
            <p className="muted small">
              HS4: {config.hs} ({t("hs4Manual")})
            </p>
          ) : null}
          <label>
            HS
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
                  <div key={factor} className="factor-vars">
                    <strong>{factor}</strong>
                    {vars.map((v) => {
                      const cov = panel.coveragePct[v.id] ?? 0;
                      const checked = selectedVars.has(v.id);
                      return (
                        <label key={v.id} className="var-check">
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
            ) : (
              <p className="muted">{t("loading")}</p>
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
              <option value="expert_mean">{t("presetExpert2025")}</option>
              <option value="equal">{t("weightsEqual")}</option>
              <option value="manual">{t("weightsManual")}</option>
              <option value="entropy">entropy</option>
              <option value="critic">CRITIC</option>
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
                    value={Math.round((factorWeights[f] ?? 0) * 100)}
                    onChange={(e) => {
                      const raw = Number(e.target.value) / 100;
                      const next = { ...factorWeights, [f]: raw };
                      const sum = Object.values(next).reduce((a, b) => a + b, 0);
                      const norm =
                        sum > 0
                          ? Object.fromEntries(
                              Object.entries(next).map(([k, v]) => [k, v / sum]),
                            )
                          : next;
                      setConfig({ weightScheme: "manual", factorWeights: norm });
                    }}
                  />
                  <span className="muted small">
                    {((factorWeights[f] ?? 0) * 100).toFixed(0)}%
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
              <option value="minmax">minmax</option>
              <option value="ratio_legacy">ratio_legacy</option>
              <option value="zscore">zscore</option>
              <option value="rank">rank</option>
              <option value="log_minmax">log_minmax</option>
            </select>
          </label>

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
              <option value="wsm">wsm</option>
              <option value="topsis">topsis</option>
              <option value="vikor">vikor</option>
              <option value="promethee_ii">promethee_ii</option>
            </select>
          </label>

          <label>
            {t("missingThreshold")}
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.missingThreshold ?? 0.2}
              data-testid="missing-threshold"
              onChange={(e) =>
                setConfig({
                  missingThreshold: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </label>

          <div className="config-actions">
            <button type="button" onClick={() => saveProject("local")}>
              {t("saveProject")}
            </button>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([exportProject()], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "ims-atlas-project.json";
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
                accept="application/json,.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  importProject(text);
                }}
              />
            </label>
          </div>
        </div>
      </details>
    </aside>
  );
}
