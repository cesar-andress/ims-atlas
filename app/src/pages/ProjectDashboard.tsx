import { AnalysisPage } from "../components/AnalysisPage";
import { PermalinkLink } from "../components/PermalinkLink";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { configToSearch, pathForView } from "../state/urlState";
import { useAnalysis } from "../state/useAnalysis";
import {
  atlasJsonBlob,
  downloadBlob,
  projectWorkbookZip,
  safeFilename,
} from "../state/projectExport";
import { projectFromConfig } from "../state/projectStore";

function DashboardBody() {
  const { t } = useTranslation();
  const { config, activeProject, dirty } = useAnalysis();
  const { model } = useRankingModel();

  const project = projectFromConfig(config, activeProject?.name, activeProject);

  const permalink = `${pathForView("ranking")}${configToSearch({
    ...config,
    view: "ranking",
  })}`;

  const top = model?.ranking.slice(0, 5) ?? [];

  return (
    <div className="project-dashboard" data-testid="project-dashboard-body">
      <p data-testid="project-dash-title">
        <strong>{project.name}</strong>
        {dirty ? <span className="unsaved-dot" title={t("projectUnsaved")} /> : null}
      </p>
      <p className="muted small">
        {project.config.origin ?? "-"} · HS{project.config.hs ?? "-"} ·{" "}
        {project.yearFrom ?? project.config.year ?? "-"}–
        {project.yearTo ?? project.config.year ?? "-"}
        {project.dataReleaseId ? ` · release ${project.dataReleaseId}` : ""}
      </p>

      <nav className="project-dash-links" aria-label={t("projectDashNav")}>
        <PermalinkLink view="ranking">{t("nav.ranking")}</PermalinkLink>
        <PermalinkLink view="matrix">{t("nav.matrix")}</PermalinkLink>
        <PermalinkLink view="map">{t("nav.map")}</PermalinkLink>
        <PermalinkLink view="project_coverage">
          {t("nav.project_coverage")}
        </PermalinkLink>
        <PermalinkLink view="project_variables">
          {t("nav.project_variables")}
        </PermalinkLink>
        <PermalinkLink view="time">{t("nav.time")}</PermalinkLink>
      </nav>

      <section data-testid="project-dash-ranking">
        <h2>{t("projectDashRanking")}</h2>
        {top.length === 0 ? (
          <p className="muted">{t("dataReleasePending")}</p>
        ) : (
          <ol>
            {top.map((r) => (
              <li key={r.iso3}>
                {r.rank}. {r.iso3} ({r.score.toFixed(3)})
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2>{t("projectDashUpdates")}</h2>
        <p className="muted small">{t("projectDashUpdatesEmpty")}</p>
      </section>

      <div className="project-dash-export">
        <button
          type="button"
          data-testid="project-dash-export-atlas"
          onClick={() =>
            downloadBlob(
              atlasJsonBlob(project),
              `${safeFilename(project.name)}.atlas.json`,
            )
          }
        >
          .atlas.json
        </button>
        <button
          type="button"
          data-testid="project-dash-export-tables"
          onClick={() =>
            downloadBlob(
              projectWorkbookZip(project),
              `${safeFilename(project.name)}-tables.zip`,
            )
          }
        >
          {t("projectExportTables")}
        </button>
        <a href={permalink} data-testid="project-dash-permalink">
          {t("projectPermalink")}
        </a>
        <p className="muted small">{t("projectPdfLater")}</p>
      </div>
    </div>
  );
}

export function ProjectDashboard() {
  const { t } = useTranslation();
  const { model, error } = useRankingModel();
  return (
    <AnalysisPage
      testId="project-dashboard-view"
      titleKey="nav.project_dashboard"
      intro={t("projectDashIntro")}
      model={model}
      error={error}
      allowWithoutModel
    >
      {() => <DashboardBody />}
    </AnalysisPage>
  );
}
