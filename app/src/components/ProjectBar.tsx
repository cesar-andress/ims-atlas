import { useCallback, useEffect, useRef, useState } from "react";
import { hsLabel } from "../data/hsProducts";
import { countryLabel } from "../design/formatLocale";
import { methodFamilyLabel, methodPlainLabel } from "../design/plainLabels";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import {
  atlasJsonBlob,
  downloadBlob,
  projectWorkbookZip,
  safeFilename,
} from "../state/projectExport";
import { duplicateProject } from "../state/projectLibrary";
import {
  isScopeComplete,
  OPEN_SCOPE_EVENT,
} from "../state/projectScope";
import { persistActiveProject, projectFromConfig } from "../state/projectStore";
import { useToast } from "../state/toastContext";
import { useAnalysis } from "../state/useAnalysis";
import { useProjectData } from "../state/useProjectData";
import { isAnalysisReady, projectStepOf, type ProjectStep } from "../state/views";
import { PermalinkLink } from "./PermalinkLink";
import {
  ProjectScopeFields,
  type ProjectScopeFieldsHandle,
} from "./ProjectScopeFields";

const WEIGHT_STATUS_KEY: Record<string, string> = {
  expert_mean: "stepWeightsExpert",
  equal: "stepWeightsEqual",
  manual: "stepWeightsOwn",
  entropy: "stepWeightsComputed",
  critic: "stepWeightsComputed",
};

function ScopeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const doneRef = useRef<HTMLButtonElement>(null);
  const fieldsRef = useRef<ProjectScopeFieldsHandle>(null);
  const [incomplete, setIncomplete] = useState(false);

  useEffect(() => {
    doneRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onDone() {
    const snap = fieldsRef.current?.flush();
    if (!snap || !isScopeComplete(snap)) {
      setIncomplete(true);
      return;
    }
    setIncomplete(false);
    onClose();
  }

  return (
    <div className="onboarding-overlay" data-testid="project-scope-dialog">
      <div
        className="onboarding-card scope-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-dialog-title"
      >
        <h2 id="scope-dialog-title" className="m-0 text-lg font-semibold">
          {t("scopeDialogTitle")}
        </h2>
        <p className="muted small">{t("scopeDialogBody")}</p>
        {incomplete ? (
          <p className="error small" role="alert" data-testid="scope-dialog-incomplete">
            {t("scopeDialogIncomplete")}
          </p>
        ) : null}
        <ProjectScopeFields ref={fieldsRef} highlightMissing={incomplete} />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn"
            data-testid="project-scope-cancel"
            onClick={onClose}
          >
            {t("scopeDialogCancel")}
          </button>
          <button
            ref={doneRef}
            type="button"
            className="btn btn-primary"
            data-testid="project-scope-done"
            onClick={onDone}
          >
            {t("scopeDialogDone")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Project name, scope chips, Duplicar / Exportar and the three-step stepper. */
export function ProjectBar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const toast = useToast();
  const { config, activeProject, dirty, saveStatus, saveProject, openProject } =
    useAnalysis();
  const { model } = useRankingModel();
  const data = useProjectData();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const autoOpenedForResults = useRef(false);

  const openScope = useCallback(() => setScopeOpen(true), []);

  useEffect(() => {
    if (editing) renameRef.current?.select();
  }, [editing]);

  const ready = isAnalysisReady(config);
  const step: ProjectStep | null = projectStepOf(config.view);

  // Results with incomplete scope: open the modal instead of a blank ranking pane.
  useEffect(() => {
    if (step === 3 && !ready) {
      setScopeOpen(true);
      autoOpenedForResults.current = true;
      return;
    }
    if (ready && autoOpenedForResults.current) {
      setScopeOpen(false);
      autoOpenedForResults.current = false;
    }
  }, [step, ready]);

  useEffect(() => {
    const onOpen = () => openScope();
    window.addEventListener(OPEN_SCOPE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SCOPE_EVENT, onOpen);
  }, [openScope]);
  const name = activeProject?.name ?? t("projectUntitled");
  const statusLabel =
    saveStatus === "saving"
      ? t("projectSaving")
      : saveStatus === "error"
        ? t("projectSaveFailed")
        : saveStatus === "saved_team"
          ? t("projectSavedTeamAgo")
          : saveStatus === "saved" || (activeProject !== null && !dirty)
            ? t("projectSavedAgo")
            : dirty
              ? t("projectUnsaved")
              : null;

  const nMarkets = model?.prepared.candidates.length;
  const nCriteria = model ? Object.keys(model.weights.factors).length : undefined;
  const method =
    methodFamilyLabel(config.methodFamily) ??
    methodPlainLabel("mcdm", config.mcdm ?? "wsm", t);

  function startRename() {
    setDraft(name);
    setEditing(true);
  }

  function commitRename() {
    const next = draft.trim().slice(0, 160);
    setEditing(false);
    if (next && next !== name) void saveProject(next);
  }

  function currentProject() {
    return projectFromConfig(config, activeProject?.name ?? name, activeProject);
  }

  async function onDuplicate() {
    setBusy(true);
    try {
      const savedProject = await persistActiveProject(currentProject());
      const copy = await duplicateProject(savedProject.id, t("projectCopySuffix"));
      openProject(copy, config.view);
      toast.push(t("projectDuplicated"));
    } finally {
      setBusy(false);
    }
  }

  function onExport(kind: "atlas" | "tables") {
    const project = currentProject();
    if (kind === "atlas") {
      downloadBlob(atlasJsonBlob(project), `${safeFilename(project.name)}.atlas.json`);
    } else {
      downloadBlob(
        projectWorkbookZip(project),
        `${safeFilename(project.name)}-tables.zip`,
      );
    }
  }

  const warnCount = data.warnings.length;
  const warnText =
    warnCount === 0
      ? t("stepWarnNone")
      : warnCount === 1
        ? t("stepWarnOne")
        : t("stepWarnMany").replace("{n}", String(warnCount));
  const dataStatus = data.loading
    ? t("loading")
    : t("stepDatosStatus")
        .replace("{sources}", String(data.nSources))
        .replace("{warnings}", warnText);
  const weightsKey = WEIGHT_STATUS_KEY[config.weightScheme ?? "expert_mean"];
  const weightsStatus = ready
    ? t("stepVariablesStatus")
        .replace("{criteria}", nCriteria !== undefined ? String(nCriteria) : "-")
        .replace("{weights}", t(weightsKey ?? "stepWeightsExpert"))
    : t("stepNeedScope");

  const chipEmpty = t("chipChoose");

  return (
    <section className="pbar" data-testid="project-bar" aria-label={t("projectBar")}>
      <div className="wrap">
        <div className="prow">
          {editing ? (
            <input
              className="pbar-rename"
              data-testid="project-name-input"
              aria-label={t("projectRename")}
              value={draft}
              maxLength={160}
              ref={renameRef}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <p className="pbar-name" data-testid="project-name">
              {name}
              <button
                type="button"
                className="pbar-edit"
                data-testid="project-rename"
                aria-label={t("projectRename")}
                title={t("projectRename")}
                onClick={startRename}
              >
                ✎
              </button>
            </p>
          )}
          {activeProject?.isExample ? (
            <span className="saved example" data-testid="project-example-badge">
              {t("projectExample")}
            </span>
          ) : null}
          {statusLabel ? (
            saveStatus === "error" ? (
              <button
                type="button"
                className="saved dirty save-status-error"
                data-testid="project-save-status"
                onClick={() => void saveProject()}
              >
                {statusLabel}
              </button>
            ) : (
              <span
                className={`saved${dirty || saveStatus === "saving" ? " dirty" : ""}`}
                data-testid={
                  saveStatus === "saving"
                    ? "project-saving"
                    : dirty
                      ? "project-unsaved"
                      : "project-saved"
                }
              >
                {dirty && saveStatus !== "saving" ? (
                  <span className="unsaved-dot" data-testid="unsaved-dot" aria-hidden />
                ) : null}
                {statusLabel}
              </span>
            )
          ) : null}
          <span className="spacer" />
          <button
            type="button"
            className="btn"
            data-testid="project-save"
            disabled={busy || saveStatus === "saving"}
            onClick={() => void saveProject()}
          >
            {t("saveProject")}
          </button>
          <button
            type="button"
            className="btn"
            data-testid="project-duplicate"
            disabled={busy || !ready}
            onClick={() => void onDuplicate()}
          >
            {t("projectDuplicate")}
          </button>
          <details className="pbar-export" data-testid="project-export">
            <summary className="btn primary">{t("projectExport")}</summary>
            <div className="pbar-export-panel">
              <button
                type="button"
                data-testid="project-export-atlas"
                onClick={() => onExport("atlas")}
              >
                {t("projectExportAtlas")}
              </button>
              <button
                type="button"
                data-testid="project-export-tables"
                onClick={() => onExport("tables")}
              >
                {t("projectExportTables")}
              </button>
              <PermalinkLink view="cite" data-testid="project-export-cite">
                {t("projectExportCite")}
              </PermalinkLink>
            </div>
          </details>
        </div>

        <div
          className="chips"
          aria-label={t("projectSummary")}
          data-testid="project-chips"
        >
          <button
            type="button"
            className={`chip${!config.origin ? " chip-missing" : ""}`}
            data-testid="chip-origin"
            onClick={() => setScopeOpen(true)}
          >
            {t("chipOrigin")}{" "}
            <b>{config.origin ? countryLabel(config.origin, lang) : chipEmpty}</b>
          </button>
          <button
            type="button"
            className={`chip${!config.hs ? " chip-missing" : ""}`}
            data-testid="chip-product"
            onClick={() => setScopeOpen(true)}
          >
            {t("chipProduct")} <b>{config.hs ? hsLabel(config.hs, lang) : chipEmpty}</b>
          </button>
          <button
            type="button"
            className={`chip${config.year == null ? " chip-missing" : ""}`}
            data-testid="chip-year"
            onClick={() => setScopeOpen(true)}
          >
            {t("chipYear")} <b>{config.year ?? chipEmpty}</b>
          </button>
          <PermalinkLink view="variables" className="chip" data-testid="chip-markets">
            {t("chipMarkets")} <b>{nMarkets ?? "-"}</b>
          </PermalinkLink>
          <PermalinkLink view="variables" className="chip" data-testid="chip-criteria">
            {t("chipCriteria")} <b>{nCriteria ?? "-"}</b>
          </PermalinkLink>
          <PermalinkLink view="variables" className="chip" data-testid="chip-method">
            {t("chipMethod")} <b>{method}</b>
          </PermalinkLink>
        </div>

        <nav
          className="steps"
          aria-label={t("projectSteps")}
          data-testid="project-steps"
        >
          <PermalinkLink
            view="datos"
            className={`step${data.rows.length > 0 ? " done" : ""}`}
            aria-current={step === 1 ? "step" : undefined}
            data-testid="step-datos"
          >
            <span className="n">1</span>
            <span className="t">
              <b>{t("stepDatos")}</b>
              <span>{dataStatus}</span>
            </span>
          </PermalinkLink>
          <PermalinkLink
            view="variables"
            className={`step${ready && model ? " done" : ""}`}
            aria-current={step === 2 ? "step" : undefined}
            data-testid="step-variables"
          >
            <span className="n">2</span>
            <span className="t">
              <b>{t("stepVariables")}</b>
              <span>{weightsStatus}</span>
            </span>
          </PermalinkLink>
          <PermalinkLink
            view="analisis"
            className="step"
            aria-current={step === 3 ? "step" : undefined}
            data-testid="step-resultados"
          >
            <span className="n">3</span>
            <span className="t">
              <b>{t("stepResultados")}</b>
              <span>{t("stepResultadosStatus")}</span>
            </span>
          </PermalinkLink>
        </nav>
      </div>
      {scopeOpen ? <ScopeDialog onClose={() => setScopeOpen(false)} /> : null}
    </section>
  );
}
