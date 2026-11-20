import { useEffect, useId, useRef, useState } from "react";
import { hsLabel } from "../data/hsProducts";
import { countryLabel } from "../design/formatLocale";
import { useTranslation } from "../i18n";
import { createEmptyProject, type ProjectListItem } from "../state/projectModel";
import { getProject, listProjects, upsertProject } from "../state/projectLibrary";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisReady, isProjectScreen } from "../state/views";
import { PermalinkLink } from "./PermalinkLink";

function scopeLine(item: ProjectListItem, lang: "en" | "es"): string {
  const parts = [
    item.origin ? countryLabel(item.origin, lang) : null,
    item.hs ? hsLabel(item.hs, lang) : null,
    item.yearFrom !== undefined ? String(item.yearFrom) : null,
  ].filter((x): x is string => Boolean(x));
  return parts.join(" · ");
}

/** Header control: open a saved project without leaving the chrome. */
export function ProjectSwitcher() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, activeProject, openProject } = useAnalysis();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const name =
    activeProject?.name ??
    (isProjectScreen(config.view) ? t("projectUntitled") : t("projectChoose"));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listProjects().then((rows) => {
      if (!cancelled) setItems(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function selectProject(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const project = await getProject(id);
      if (!project) return;
      openProject(project, isAnalysisReady(project.config) ? "analisis" : "datos");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function createNew() {
    if (busy) return;
    setBusy(true);
    try {
      const project = createEmptyProject({
        name: t("projectNewName"),
        config: { v: 1, view: "datos", lang },
      });
      const saved = await upsertProject(project);
      openProject(saved, "datos");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="project-switcher" ref={rootRef} data-testid="project-switcher">
      <button
        type="button"
        className="switch"
        aria-label={t("projectSwitch")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-testid="project-switcher-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <small>{t("project")}</small>
        <b data-testid="header-project-name">{name}</b>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div
          className="project-switcher-menu"
          role="listbox"
          id={listId}
          aria-label={t("projectSwitchList")}
          data-testid="project-switcher-menu"
        >
          {items.length === 0 ? (
            <p className="muted small project-switcher-empty">
              {t("projectSwitchEmpty")}
            </p>
          ) : (
            <ul className="project-switcher-list">
              {items.map((item) => {
                const active = activeProject?.id === item.id;
                const scope = scopeLine(item, lang);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={
                        active
                          ? "project-switcher-item is-active"
                          : "project-switcher-item"
                      }
                      data-testid={`project-switcher-item-${item.id}`}
                      disabled={busy}
                      onClick={() => void selectProject(item.id)}
                    >
                      <span className="project-switcher-item-name">
                        {item.name}
                        {item.isExample ? (
                          <span className="project-switcher-example">
                            {t("projectExample")}
                          </span>
                        ) : null}
                      </span>
                      {scope ? (
                        <span className="muted small">{scope}</span>
                      ) : (
                        <span className="muted small">{t("projectScopePending")}</span>
                      )}
                      {item.updatedBy ? (
                        <span className="muted small">
                          {t("projectSwitchUpdatedBy").replace("{who}", item.updatedBy)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="project-switcher-actions">
            <button
              type="button"
              className="btn"
              data-testid="project-switcher-new"
              disabled={busy}
              onClick={() => void createNew()}
            >
              {t("projectSwitchNew")}
            </button>
            <PermalinkLink
              view="home"
              className="btn ghost"
              data-testid="project-switcher-home"
              onClick={() => setOpen(false)}
            >
              {t("projectSwitchManage")}
            </PermalinkLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
