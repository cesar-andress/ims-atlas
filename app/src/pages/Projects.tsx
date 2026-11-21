import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "../components/PageShell";
import { PermalinkLink } from "../components/PermalinkLink";
import { useAccessSession } from "../auth/accessSession";
import { useToast } from "../state/toastContext";
import { useTranslation } from "../i18n";
import {
  createEmptyProject,
  plainErrorMessage,
  type ProjectListItem,
} from "../state/projectModel";
import {
  deleteProject,
  duplicateProject,
  getLibraryStatus,
  listProjects,
  type ProjectLibraryStatus,
} from "../state/projectLibrary";
import {
  atlasJsonBlob,
  downloadBlob,
  projectWorkbookZip,
  safeFilename,
} from "../state/projectExport";
import { importAtlasProjectJson, prepareImportedProject } from "../state/projectStore";
import { useAnalysis } from "../state/useAnalysis";
import { EMPTY_PROJECT_CONFIG } from "../state/schema";
import { requestOpenScope } from "../state/projectScope";
import { preferredProjectView } from "../state/views";
import { countryLabel } from "../design/formatLocale";
import { formatProjectEditedAt } from "../design/relativeTime";

function canEditProject(item: ProjectListItem, user: string | undefined): boolean {
  if (item.source !== "team") return true;
  if (!item.createdBy) return true;
  if (!user) return false;
  return item.createdBy === user;
}

function ProjectGearMenu({
  item,
  busy,
  editable,
  onOpen,
  onRename,
  onDuplicate,
  onExportAtlas,
  onExportWorkbook,
  onDelete,
}: {
  item: ProjectListItem;
  busy: boolean;
  editable: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onExportAtlas: () => void;
  onExportWorkbook: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="project-gear" ref={rootRef}>
      <button
        type="button"
        className="project-gear-btn"
        data-testid={`project-gear-${item.id}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("projectActions")}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⚙
      </button>
      {open ? (
        <ul
          className="project-gear-menu"
          role="menu"
          data-testid={`project-gear-menu-${item.id}`}
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              data-testid={`project-open-${item.id}`}
              onClick={() => {
                setOpen(false);
                onOpen();
              }}
            >
              {t("projectOpen")}
            </button>
          </li>
          {editable ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onRename();
                }}
              >
                {t("projectRename")}
              </button>
            </li>
          ) : null}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
            >
              {t("projectDuplicate")}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExportAtlas();
              }}
            >
              .atlas.json
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExportWorkbook();
              }}
            >
              {t("projectExportTables")}
            </button>
          </li>
          {editable ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="danger"
                data-testid={`project-delete-${item.id}`}
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                {t("projectDelete")}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export function Projects() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const toast = useToast();
  const { profile } = useAccessSession();
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
        (p.hs ?? "").includes(q) ||
        (p.displayId !== undefined && String(p.displayId).includes(q)),
    );
  }, [items, query]);

  async function createNew() {
    const base = {
      ...EMPTY_PROJECT_CONFIG,
      view: "datos" as const,
      lang: lang as "en" | "es",
    };
    const partial = {
      name: lang === "es" ? "Proyecto nuevo" : "New project",
      config: base,
    };
    const project = createEmptyProject(partial);
    const { upsertProject } = await import("../state/projectLibrary");
    try {
      const saved = await upsertProject(project);
      await refresh();
      openProject(saved, "datos");
      // Three-question scope wizard (origin · product · year); nothing preselected.
      requestOpenScope();
      toast.push(t("projectCreated"));
    } catch (err) {
      toast.push(plainErrorMessage(err));
    }
  }

  async function onOpen(id: string) {
    const { getProject } = await import("../state/projectLibrary");
    const p = await getProject(id);
    if (!p) return;
    openProject(p, preferredProjectView(p.config));
  }

  async function onRename(id: string, current: string) {
    const next = window.prompt(t("projectRenamePrompt"), current);
    if (!next || !next.trim() || next.trim() === current) return;
    setBusyId(id);
    try {
      const { getProject, upsertProject } = await import("../state/projectLibrary");
      const p = await getProject(id);
      if (!p) return;
      await upsertProject({
        ...p,
        name: next.trim().slice(0, 160),
        updatedAt: new Date().toISOString(),
      });
      await refresh();
    } catch (err) {
      toast.push(plainErrorMessage(err));
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
    } catch (err) {
      toast.push(plainErrorMessage(err));
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
    } catch (err) {
      toast.push(plainErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onExportAtlas(id: string) {
    const { getProject } = await import("../state/projectLibrary");
    const p = await getProject(id);
    if (!p) return;
    downloadBlob(atlasJsonBlob(p), `${safeFilename(p.name)}.atlas.json`);
  }

  async function onExportWorkbook(id: string) {
    const { getProject } = await import("../state/projectLibrary");
    const p = await getProject(id);
    if (!p) return;
    downloadBlob(projectWorkbookZip(p), `${safeFilename(p.name)}-tables.zip`);
  }

  function onImportFile(file: File) {
    setImportError(null);
    void file.text().then(async (text) => {
      try {
        const imported = importAtlasProjectJson(text);
        const project = prepareImportedProject(
          imported,
          lang === "es" ? "importado" : "imported",
        );
        const { upsertProject } = await import("../state/projectLibrary");
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
          className="btn primary"
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

      {filtered.length === 0 ? (
        <p className="muted" data-testid="projects-kanban-empty">
          {t("projectsEmpty")}
        </p>
      ) : (
        <div className="projects-kanban" data-testid="projects-kanban">
          {/* Keep legacy test id for older e2e until CI catches up */}
          <div className="visually-hidden" data-testid="projects-table" aria-hidden>
            kanban
          </div>
          {filtered.map((p) => {
            const editable = canEditProject(p, profile?.user);
            const scope = [
              p.origin ? countryLabel(p.origin, lang) : null,
              p.hs ? `HS ${p.hs}` : null,
              p.yearFrom !== undefined ? String(p.yearFrom) : null,
            ].filter((x): x is string => x !== null);
            const edited = formatProjectEditedAt(p.updatedAt, lang);
            return (
              <article
                key={p.id}
                className="project-kanban-card"
                data-testid={`project-card-${p.id}`}
              >
                <header className="project-kanban-head">
                  <div className="project-kanban-title">
                    {p.displayId !== undefined ? (
                      <span
                        className="project-display-id"
                        data-testid={`project-id-${p.id}`}
                        title={t("projectDisplayId")}
                      >
                        #{p.displayId}
                      </span>
                    ) : null}
                    <h2>{p.name}</h2>
                  </div>
                  <ProjectGearMenu
                    item={p}
                    busy={busyId === p.id}
                    editable={editable}
                    onOpen={() => void onOpen(p.id)}
                    onRename={() => void onRename(p.id, p.name)}
                    onDuplicate={() => void onDuplicate(p.id)}
                    onExportAtlas={() => void onExportAtlas(p.id)}
                    onExportWorkbook={() => void onExportWorkbook(p.id)}
                    onDelete={() => void onDelete(p.id, p.name)}
                  />
                </header>
                <p className="project-kanban-scope">
                  {scope.length > 0 ? scope.join(" · ") : t("projectScopePending")}
                </p>
                <p className="project-kanban-meta muted small">
                  {t("projectUpdated")}: {edited}
                  {p.createdBy ? ` · ${p.createdBy}` : ""}
                  {!editable && p.source === "team" ? (
                    <> · {t("projectReadOnlyOwned")}</>
                  ) : null}
                </p>
                <button
                  type="button"
                  className="btn secondary project-kanban-open"
                  data-testid={`project-open-card-${p.id}`}
                  disabled={busyId === p.id}
                  onClick={() => void onOpen(p.id)}
                >
                  {t("projectOpen")}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
