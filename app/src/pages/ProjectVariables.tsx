import { useEffect, useMemo, useState } from "react";
import { highCorrelationWarnings, correlationMatrix } from "@ims-atlas/core";
import { AnalysisPage } from "../components/AnalysisPage";
import { LicenceBadge } from "../components/LicenceBadge";
import { PermalinkLink } from "../components/PermalinkLink";
import { loadCatalogPreview } from "../data/catalogLoader";
import type { CatalogVariable } from "../data/types";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";

const PRESETS = {
  imsfe18: null as string[] | null, // fill from catalog demand… when opened
  openOnly: null as string[] | null,
} as const;

function varName(v: CatalogVariable, lang: string): string {
  if (typeof v.name === "string") return v.name;
  return lang === "es" ? v.name.es : v.name.en;
}

function coverageRatio(v: CatalogVariable): number {
  const demo = v.coverage_demo;
  if (!demo) return 0;
  let total = 0;
  let ok = 0;
  for (const byIso of Object.values(demo)) {
    for (const val of Object.values(byIso)) {
      total += 1;
      if (val !== null && Number.isFinite(val)) ok += 1;
    }
  }
  return total === 0 ? 0 : ok / total;
}

function ProjectVariablesBody() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const [catalog, setCatalog] = useState<CatalogVariable[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    void loadCatalogPreview().then((c) => setCatalog(c.variables));
  }, []);

  const chosen = useMemo(() => {
    if (config.variableIds?.length) return new Set(config.variableIds);
    return new Set(catalog.map((v) => v.id));
  }, [config.variableIds, catalog]);

  const left = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return catalog
      .filter((v) => !chosen.has(v.id))
      .filter((v) => {
        if (!qq) return true;
        const name = varName(v, lang);
        return (
          v.id.toLowerCase().includes(qq) ||
          name.toLowerCase().includes(qq) ||
          v.factor.toLowerCase().includes(qq)
        );
      });
  }, [catalog, chosen, q, lang]);

  const right = useMemo(
    () => catalog.filter((v) => chosen.has(v.id)),
    [catalog, chosen],
  );

  const byFactor = useMemo(() => {
    const map = new Map<string, CatalogVariable[]>();
    for (const v of right) {
      const list = map.get(v.factor) ?? [];
      list.push(v);
      map.set(v.factor, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [right]);

  const corrWarns = useMemo(() => {
    if (right.length < 2) return [];
    const cols = right.map((v) => v.id);
    const series = right.map((v) => {
      const demo = v.coverage_demo ?? {};
      const flat: number[] = [];
      for (const byIso of Object.values(demo)) {
        for (const val of Object.values(byIso)) {
          flat.push(val !== null && Number.isFinite(val) ? (val as number) : 0);
        }
      }
      return flat.slice(0, 24);
    });
    if (series.some((s) => s.length < 3)) return [];
    const mat = correlationMatrix(cols, series);
    return highCorrelationWarnings(cols, mat, 0.8);
  }, [right]);

  const nFactors = byFactor.length;
  const covAvg =
    right.length === 0
      ? 0
      : right.reduce((s, v) => s + coverageRatio(v), 0) / right.length;
  const nWarns =
    corrWarns.length +
    right.filter((v) => !v.redistributable).length +
    right.filter((v) => coverageRatio(v) < 0.5 && v.coverage_demo).length;

  function setChosen(ids: string[]) {
    setConfig({ variableIds: ids });
  }

  function add(id: string) {
    setChosen([...chosen, id]);
  }

  function remove(id: string) {
    setChosen([...chosen].filter((x) => x !== id));
  }

  function applyOpenOnly() {
    setChosen(catalog.filter((v) => v.redistributable).map((v) => v.id));
  }

  function applyAllCatalog() {
    setChosen(catalog.map((v) => v.id));
  }

  void PRESETS;

  return (
    <div className="project-vars" data-testid="project-variables-body">
      <div className="project-vars-summary" data-testid="project-vars-summary">
        {t("projectVarsSummary")
          .replace("{n}", String(right.length))
          .replace("{c}", String(nFactors))
          .replace("{cov}", `${Math.round(covAvg * 100)}`)
          .replace("{w}", String(nWarns))}
      </div>
      <div className="project-vars-presets">
        <button type="button" data-testid="preset-open-only" onClick={applyOpenOnly}>
          {t("projectPresetOpen")}
        </button>
        <button type="button" onClick={applyAllCatalog}>
          {t("projectPresetAll")}
        </button>
        <PermalinkLink view="project_coverage">
          {t("projectCoverageLink")}
        </PermalinkLink>
      </div>
      <div className="project-vars-grid">
        <section aria-label={t("projectVarsAvailable")}>
          <h2>{t("projectVarsAvailable")}</h2>
          <input
            type="search"
            data-testid="project-vars-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("projectSearch")}
          />
          <ul className="project-var-cards">
            {left.map((v) => (
              <li key={v.id} className="project-var-card">
                <div>
                  <strong>{v.id}</strong>{" "}
                  <span className="muted small">{varName(v, lang)}</span>
                </div>
                <div className="small muted">
                  {v.factor} · {v.source_ids[0] ?? "—"}
                </div>
                <LicenceBadge licenceId={v.licence_ids[0] ?? "UNKNOWN"} />
                <div
                  className="coverage-bar"
                  title={`${Math.round(coverageRatio(v) * 100)}%`}
                >
                  <span style={{ width: `${coverageRatio(v) * 100}%` }} />
                </div>
                <button type="button" onClick={() => add(v.id)}>
                  {t("projectVarAdd")}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section aria-label={t("projectVarsChosen")}>
          <h2>{t("projectVarsChosen")}</h2>
          {byFactor.map(([factor, vars]) => (
            <div key={factor} className="project-var-factor">
              <h3>{factor}</h3>
              <ul className="project-var-cards">
                {vars.map((v) => (
                  <li key={v.id} className="project-var-card chosen">
                    <div>
                      <strong>{v.id}</strong>
                      {!v.redistributable ? (
                        <span className="warn small"> {t("projectWarnLicence")}</span>
                      ) : null}
                    </div>
                    <label className="small">
                      {t("transparencyDirection")}{" "}
                      <select
                        value={v.direction === "cost" ? "cost" : "benefit"}
                        disabled
                        title={t("projectDirHint")}
                      >
                        <option value="benefit">benefit</option>
                        <option value="cost">cost</option>
                      </select>
                    </label>
                    <button type="button" onClick={() => remove(v.id)}>
                      {t("projectVarRemove")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {corrWarns.length > 0 ? (
            <ul data-testid="project-vars-corr" className="small">
              {corrWarns.map((w) => (
                <li key={`${w.a}-${w.b}`}>
                  {lang === "es" ? w.messageEs : w.messageEn}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function ProjectVariables() {
  const { t } = useTranslation();
  const { model, error } = useRankingModel();
  return (
    <AnalysisPage
      testId="project-variables-view"
      titleKey="nav.project_variables"
      intro={t("projectVarsIntro")}
      model={model}
      error={error}
      allowWithoutModel
    >
      {() => <ProjectVariablesBody />}
    </AnalysisPage>
  );
}
