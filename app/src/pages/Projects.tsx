import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { useToast } from "../state/toastContext";
import { useTranslation } from "../i18n";
import {
  createEmptyProject,
  defaultNameFromConfig,
  plainErrorMessage,
  type ProjectListItem,
} from "../state/projectModel";
import {
  deleteProject,
  duplicateProject,
  getLibraryStatus,
  listProjects,
  type ProjectLibraryStatus,
} from "../state/projectIdb";
import {
  atlasJsonBlob,
  downloadBlob,
  projectWorkbookZip,
  safeFilename,
} from "../state/projectExport";
import { importAtlasProjectJson } from "../state/projectStore";
import { useAnalysis } from "../state/useAnalysis";
import { COL_HS64_PRESET } from "../state/schema";

export function Projects() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const toast = useToast();
  const { config, openProject, clearActiveProject, activeProject } = useAnalysis();
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [status, setStatus] = useState<ProjectLibraryStatus | null>(null);
  const [query, setQuery] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getLibraryStatus());
    setItems(await listProjects());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.origin ?? "").toLowerCase().includes(q) ||
        (p.hs ?? "").includes(q),
    );
  }, [items, query]);

  async function createNew() {
    const base = {
      ...COL_HS64_PRESET,
      view: "project_dashboard" as const,
      lang: lang as "en" | "es",
    };
    const partial = {
      name: defaultNameFromConfig(base),
      config: base,
      ...(base.year !== undefined ? { yearFrom: base.year, yearTo: base.year } : {}),
    };
    const project = createEmptyProject(partial);
    const { upsertProject } = await import("../state/projectIdb");
    const saved = await upsertProject(project);
    await refresh();
    openProject(saved);
    toast.push(t("projectCreated"));
  }

  async function onOpen(id: string) {
    const { getProject } = await import("../state/projectIdb");
    const p = await getProject(id);
    if (!p) return;
    openProject(p);
  }

  async function onRename(id: string, current: string) {
    const next = window.prompt(t("projectRenamePrompt"), current);
    if (!next || !next.trim() || next.trim() === current) return;
    setBusyId(id);
    try {
      const { getProject, upsertProject } = await import("../state/projectIdb");
      const p = await getProject(id);
      if (!p) return;
      await upsertProject({
        ...p,
        name: next.trim().slice(0, 160),
        updatedAt: new Date().toISOString(),
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onDuplicate(id: string) {
    setBusyId(id);
    try {
      await duplicateProject(id);
      await refresh();
      toast.push(t("projectDuplicated"));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(t("projectDeleteConfirm").replace("{name}", name))) return;
    setBusyId(id);
    try {
      await deleteProject(id);
      if (activeProject?.id === id) clearActiveProject();
      await refresh();
      toast.push(t("projectDeleted"));
    } finally {
      setBusyId(null);
    }
  }

  async function onExportAtlas(id: string) {
    const { getProject } = await import("../state/projectIdb");
    const p = await getProject(id);
    if (!p) return;
    downloadBlob(atlasJsonBlob(p), `${safeFilename(p.name)}.atlas.json`);
  }

  async function onExportWorkbook(id: string) {
    const { getProject } = await import("../state/projectIdb");
    const p = await getProject(id);
    if (!p) return;
    downloadBlob(projectWorkbookZip(p), `${safeFilename(p.name)}-tables.zip`);
  }

  function onImportFile(file: File) {
    setImportError(null);
    void file.text().then(async (text) => {
      try {
        const project = importAtlasProjectJson(text);
        const { upsertProject } = await import("../state/projectIdb");
        const saved = await upsertProject(project);
        await refresh();
        openProject(saved);
        toast.push(t("projectImported"));
      } catch (err) {
        setImportError(plainErrorMessage(err));
      }
    });
  }

  return (
    <PageShell testId="projects-view" titleKey="nav.projects" className="projects-page">
      <p className="muted">{t("projectsIntro")}</p>
      {status?.warning ? (
        <p className="warn" role="status" data-testid="projects-storage-warn">
          {status.warning}
        </p>
      ) : null}

      <div className="projects-toolbar">
        <button
          type="button"
          data-testid="project-create"
          onClick={() => void createNew()}
        >
          {t("projectCreate")}
        </button>
        <label className="file-import" data-testid="project-import-label">
          {t("importProject")}
          <input
            type="file"
            accept=".json,.atlas.json,application/json"
            data-testid="project-import"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <input
          type="search"
          data-testid="project-search"
          placeholder={t("projectSearch")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("projectSearch")}
        />
        <PermalinkLink view="project_variables">
          {t("projectVariablesLink")}
        </PermalinkLink>
        <PermalinkLink view="project_coverage">
          {t("projectCoverageLink")}
        </PermalinkLink>
      </div>

      {importError ? (
        <p className="error" role="alert" data-testid="project-import-error">
          {importError}
        </p>
      ) : null}

      <p className="small muted" data-testid="projects-active">
        {activeProject
          ? t("projectActive").replace("{name}", activeProject.name)
          : t("projectNoneActive")}
        {config.origin ? ` · ${config.origin}` : ""}
        {config.hs ? ` · HS${config.hs}` : ""}
      </p>

      <table className="projects-table" data-testid="projects-table">
        <thead>
          <tr>
            <th>{t("projectName")}</th>
            <th>{t("origin")}</th>
            <th>HS</th>
            <th>{t("projectUpdated")}</th>
            <th>{t("projectActions")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                {t("projectsEmpty")}
              </td>
            </tr>
          ) : (
            filtered.map((p) => (
              <tr key={p.id} data-testid={`project-row-${p.id}`}>
                <td>{p.name}</td>
                <td>{p.origin ?? "—"}</td>
                <td>{p.hs ?? "—"}</td>
                <td>{p.updatedAt.slice(0, 19).replace("T", " ")}</td>
                <td className="projects-actions">
                  <button
                    type="button"
                    data-testid={`project-open-${p.id}`}
                    disabled={busyId === p.id}
                    onClick={() => void onOpen(p.id)}
                  >
                    {t("projectOpen")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRename(p.id, p.name)}
                    disabled={busyId === p.id}
                  >
                    {t("projectRename")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDuplicate(p.id)}
                    disabled={busyId === p.id}
                  >
                    {t("projectDuplicate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onExportAtlas(p.id)}
                    disabled={busyId === p.id}
                  >
                    .atlas.json
                  </button>
                  <button
                    type="button"
                    onClick={() => void onExportWorkbook(p.id)}
                    disabled={busyId === p.id}
                  >
                    {t("projectExportTables")}
                  </button>
                  <button
                    type="button"
                    data-testid={`project-delete-${p.id}`}
                    onClick={() => void onDelete(p.id, p.name)}
                    disabled={busyId === p.id}
                  >
                    {t("projectDelete")}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </PageShell>
  );
}
