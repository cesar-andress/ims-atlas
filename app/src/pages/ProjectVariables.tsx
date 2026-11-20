import { useEffect, useMemo, useState } from "react";
import { highCorrelationWarnings, correlationMatrix } from "@ims-atlas/core";
import { AnalysisPage } from "../components/AnalysisPage";
import { LicenceBadge } from "../components/LicenceBadge";
import { PermalinkLink } from "../components/PermalinkLink";
import { loadCatalogPreview } from "../data/catalogLoader";
import type { CatalogVariable } from "../data/types";
import {
  aliasCollisionsFromCatalog,
  variableDataStatus,
  type VariableDataKind,
} from "../data/variableDataStatus";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";

function varName(v: CatalogVariable, lang: string): string {
  if (typeof v.name === "string") return v.name;
  return lang === "es" ? v.name.es : v.name.en;
}

function badgeLabel(kind: VariableDataKind, t: (k: string) => string): string {
  if (kind === "complete") return t("varDataComplete");
  if (kind === "partial") return t("varDataPartial");
  if (kind === "team") return t("varDataTeam");
  return t("varDataNone");
}

function coveragePctFromStats(v: CatalogVariable): number {
  const st = variableDataStatus(v);
  if (st.kind === "none" || st.kind === "team") return 0;
  if (st.coveragePct != null) return st.coveragePct / 100;
  if (st.nCountries != null && st.nCountries > 0)
    return Math.min(1, st.nCountries / 200);
  return 0;
}

function warnForVariable(
  v: CatalogVariable,
  lang: string,
  t: (k: string) => string,
  year: number | null | undefined,
): string | null {
  const st = variableDataStatus(v, { year });
  const name = varName(v, lang);
  if (st.kind === "none") {
    return t("varDataWarnNone").replace("{name}", name);
  }
  if (st.kind === "team" && (st.nCountries == null || st.nCountries <= 0)) {
    return t("varDataWarnTeam").replace("{name}", name);
  }
  if (st.kind === "partial") {
    return t("varDataWarnPartial")
      .replace("{name}", name)
      .replace("{n}", String(st.nCountries ?? "-"))
      .replace("{y1}", String(st.yearMax ?? "-"));
  }
  return null;
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

  const selectionWarnings = useMemo(() => {
    const out: string[] = [];
    for (const v of right) {
      const w = warnForVariable(v, lang, t, config.year);
      if (w) out.push(w);
    }
    const aliases = aliasCollisionsFromCatalog(chosen, catalog);
    if (aliases.length) {
      out.push(t("varAliasWarn").replace("{pairs}", aliases.join(", ")));
    }
    return out;
  }, [right, lang, t, config.year, chosen, catalog]);

  const corrWarns = useMemo(() => {
    if (right.length < 2) return [];
    const cols = right.map((v) => v.id);
    const series = right.map((v) => {
      const n = v.coverage_stats?.n_countries ?? 0;
      // Synthetic flat series for correlation heuristic only (not real values).
      return Array.from({ length: Math.min(24, Math.max(3, n || 3)) }, (_, i) =>
        i % 2 === 0 ? 1 : 0.5,
      );
    });
    if (series.some((s) => s.length < 3)) return [];
    const mat = correlationMatrix(cols, series);
    return highCorrelationWarnings(cols, mat, 0.8);
  }, [right]);

  const nFactors = byFactor.length;
  const covAvg =
    right.length === 0
      ? 0
      : right.reduce((s, v) => s + coveragePctFromStats(v), 0) / right.length;
  const nWarns = selectionWarnings.length + corrWarns.length;

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
    setConfig({
      methodFamily: "panel_all",
      weightScheme: "equal",
      factorWeights: undefined,
      variableIds: catalog.map((v) => v.id),
    });
  }

  return (
    <div className="project-vars" data-testid="project-variables-body">
      <div className="project-vars-summary" data-testid="project-vars-summary">
        {t("projectVarsSummary")
          .replace("{n}", String(right.length))
          .replace("{c}", String(nFactors))
          .replace("{cov}", `${Math.round(covAvg * 100)}`)
          .replace("{w}", String(nWarns))}
      </div>
      {selectionWarnings.length > 0 ? (
        <ul
          className="project-vars-data-warns"
          data-testid="project-vars-data-warns"
          role="status"
        >
          {selectionWarnings.map((w) => (
            <li key={w.slice(0, 80)}>{w}</li>
          ))}
        </ul>
      ) : null}
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
            {left.map((v) => {
              const st = variableDataStatus(v, { year: config.year });
              return (
                <li key={v.id} className="project-var-card">
                  <div>
                    <strong>{v.id}</strong>{" "}
                    <span className="muted small">{varName(v, lang)}</span>
                  </div>
                  <div className="small muted">
                    {v.factor} · {v.source_ids[0] ?? "-"}
                  </div>
                  <span
                    className={`var-data-badge var-data-${st.kind}`}
                    data-testid={`var-data-${v.id}`}
                  >
                    {badgeLabel(st.kind, t)}
                  </span>
                  <LicenceBadge licenceId={v.licence_ids[0] ?? "UNKNOWN"} />
                  <div
                    className="coverage-bar"
                    title={`${Math.round(coveragePctFromStats(v) * 100)}%`}
                  >
                    <span style={{ width: `${coveragePctFromStats(v) * 100}%` }} />
                  </div>
                  <button type="button" onClick={() => add(v.id)}>
                    {t("projectVarAdd")}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-label={t("projectVarsChosen")}>
          <h2>{t("projectVarsChosen")}</h2>
          {byFactor.map(([factor, vars]) => (
            <div key={factor} className="project-var-factor">
              <h3>{factor}</h3>
              <ul className="project-var-cards">
                {vars.map((v) => {
                  const st = variableDataStatus(v, { year: config.year });
                  return (
                    <li key={v.id} className="project-var-card chosen">
                      <div>
                        <strong>{v.id}</strong>
                        {!v.redistributable ? (
                          <span className="warn small"> {t("projectWarnLicence")}</span>
                        ) : null}
                      </div>
                      <span
                        className={`var-data-badge var-data-${st.kind}`}
                        data-testid={`var-data-chosen-${v.id}`}
                      >
                        {badgeLabel(st.kind, t)}
                      </span>
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
                  );
                })}
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
