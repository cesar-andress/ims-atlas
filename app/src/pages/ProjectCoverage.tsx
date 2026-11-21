import { useEffect, useMemo, useState } from "react";
import { AnalysisPage } from "../components/AnalysisPage";
import { ExportMenu } from "../components/ExportMenu";
import { PermalinkLink } from "../components/PermalinkLink";
import { loadCatalogPreview } from "../data/catalogLoader";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import {
  buildCoverageCells,
  POLICY_LABELS,
  summarizeCoverage,
  type CoverageCell,
} from "../state/coverageGrid";
import type { MissingFillPolicy } from "../state/projectModel";
import { useAnalysis } from "../state/useAnalysis";

function yearRange(from: number, to: number): number[] {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  const out: number[] = [];
  for (let y = a; y <= b; y++) out.push(y);
  return out;
}

function CoverageBody() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, activeProject, saveProject } = useAnalysis();
  const { model } = useRankingModel();
  const [inRelease, setInRelease] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CoverageCell | null>(null);
  const [policies, setPolicies] = useState<Record<string, MissingFillPolicy>>(
    () => activeProject?.missingPolicyByVar ?? {},
  );

  const yFrom = activeProject?.yearFrom ?? config.year ?? 2020;
  const yTo = activeProject?.yearTo ?? config.year ?? yFrom;
  const years = useMemo(() => yearRange(yFrom, yTo), [yFrom, yTo]);

  useEffect(() => {
    void loadCatalogPreview().then((c) => {
      setInRelease(
        new Set(c.variables.filter((v) => v.redistributable).map((v) => v.id)),
      );
    });
  }, []);

  const variableIds = useMemo(() => {
    if (config.variableIds?.length) return config.variableIds;
    if (model) return model.prepared.usedVariables;
    return [...inRelease].slice(0, 12);
  }, [config.variableIds, model, inRelease]);

  const candidates = useMemo(() => {
    if (activeProject?.candidateIsos?.length) return activeProject.candidateIsos;
    if (model) return model.prepared.candidates;
    return [];
  }, [activeProject, model]);

  const values = useMemo(() => {
    if (!model) return undefined;
    const out: Record<string, Record<number, Record<string, number | null>>> = {};
    const year = config.year ?? yTo;
    for (const id of variableIds) {
      const col = model.panel.variables.findIndex((v) => v.id === id);
      if (col < 0) continue;
      out[id] = { [year]: {} };
      for (let i = 0; i < model.panel.candidates.length; i++) {
        const iso = model.panel.candidates[i]!;
        out[id]![year]![iso] = model.panel.values[i]?.[col] ?? null;
      }
    }
    return out;
  }, [model, variableIds, config.year, yTo]);

  const cells = useMemo(() => {
    const input: Parameters<typeof buildCoverageCells>[0] = {
      variableIds,
      years,
      candidates: candidates.length ? candidates : ["XXX"],
      inRelease,
      byodMissing: new Set(
        (activeProject?.byodDefinitions ?? [])
          .map((d) => d.id)
          .filter((id) => !model?.panel.variables.some((v) => v.id === id)),
      ),
      policies,
    };
    if (values !== undefined) input.values = values;
    return buildCoverageCells(input);
  }, [
    variableIds,
    years,
    candidates,
    values,
    inRelease,
    activeProject,
    model,
    policies,
  ]);

  const summary = useMemo(
    () => summarizeCoverage(cells, variableIds, yFrom, yTo),
    [cells, variableIds, yFrom, yTo],
  );

  function setPolicy(variableId: string, policy: MissingFillPolicy) {
    setPolicies((prev) => ({ ...prev, [variableId]: policy }));
  }

  return (
    <div className="project-coverage" data-testid="project-coverage-body">
      <p className="small" data-testid="project-coverage-summary">
        {lang === "es" ? summary.linesEs[0] : summary.linesEn[0]}
      </p>
      <p className="muted small">{t("projectCoverageHint")}</p>
      <div className="coverage-scroll" data-export-surface="table">
        <ExportMenu
          testIdPrefix="project-coverage"
          kind="table"
          title="Project coverage"
          tableRows={[
            ["variable_id", "year", "state", "policy"],
            ...variableIds.flatMap((id) =>
              years.map((y) => {
                const cell = cells.find((c) => c.variableId === id && c.year === y);
                return [
                  id,
                  String(y),
                  cell?.state ?? "missing",
                  policies[id] ?? "keep",
                ];
              }),
            ),
          ]}
        />
        <table data-testid="project-coverage-grid">
          <thead>
            <tr>
              <th>{t("variables")}</th>
              {years.map((y) => (
                <th key={y}>{y}</th>
              ))}
              <th>{t("projectMissingPolicy")}</th>
            </tr>
          </thead>
          <tbody>
            {variableIds.map((id) => (
              <tr key={id}>
                <td>{id}</td>
                {years.map((y) => {
                  const cell = cells.find((c) => c.variableId === id && c.year === y);
                  const state = cell?.state ?? "missing";
                  return (
                    <td key={y}>
                      <button
                        type="button"
                        className={`cov-cell cov-${state}`}
                        data-testid={`cov-${id}-${y}`}
                        onClick={() => setSelected(cell ?? null)}
                        title={lang === "es" ? cell?.reasonEs : cell?.reasonEn}
                      >
                        {state === "available"
                          ? "✓"
                          : state === "outside_release"
                            ? "R"
                            : state === "byod_not_loaded"
                              ? "B"
                              : "·"}
                      </button>
                    </td>
                  );
                })}
                <td>
                  <select
                    data-testid={`cov-policy-${id}`}
                    value={policies[id] ?? "keep"}
                    onChange={(e) => setPolicy(id, e.target.value as MissingFillPolicy)}
                  >
                    {(Object.keys(POLICY_LABELS) as MissingFillPolicy[]).map((p) => (
                      <option key={p} value={p}>
                        {lang === "es" ? POLICY_LABELS[p].es : POLICY_LABELS[p].en}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <aside className="cov-detail" data-testid="cov-detail" role="status">
          <p>
            <strong>
              {selected.variableId} · {selected.year}
            </strong>
          </p>
          <p>{lang === "es" ? selected.reasonEs : selected.reasonEn}</p>
          <button type="button" onClick={() => setSelected(null)}>
            {t("close")}
          </button>
        </aside>
      ) : null}
      <p className="small">
        <PermalinkLink view="analisis">{t("projectDashboardLink")}</PermalinkLink>
        {" · "}
        <button type="button" onClick={() => void saveProject()}>
          {t("saveProject")}
        </button>
      </p>
    </div>
  );
}

export function ProjectCoverage() {
  const { t } = useTranslation();
  const { model, error } = useRankingModel();
  return (
    <AnalysisPage
      testId="project-coverage-view"
      titleKey="nav.project_coverage"
      intro={t("projectCoverageIntro")}
      model={model}
      error={error}
      allowWithoutModel
    >
      {() => <CoverageBody />}
    </AnalysisPage>
  );
}
