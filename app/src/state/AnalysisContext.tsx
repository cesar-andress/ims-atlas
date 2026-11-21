import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "./toastContext";
import { AnalysisContext, type AnalysisContextValue } from "./analysisContextBase";
import type { AtlasProject } from "./projectModel";
import { defaultNameFromConfig } from "./projectModel";
import {
  exportProjectJson,
  importAtlasProjectJson,
  importProjectJson,
  loadProjectFromStorage,
  persistActiveProject,
  prepareImportedProject,
  projectFromConfig,
} from "./projectStore";
import { readActiveProjectId, writeActiveProjectId } from "./activeProjectPersist";
import { saveDraft } from "./projectIdb";
import { getProject, upsertProject } from "./projectLibrary";
import { DEFAULT_CONFIG, type AnalysisConfig, type ViewId } from "./schema";
import {
  configToSearch,
  focusVariableFromPath,
  parseConfigFromSearch,
  pathForView,
  viewFromPath,
} from "./urlState";
import { preferredProjectView } from "./views";

function uiIsSpanish(lang: AnalysisConfig["lang"]): boolean {
  const current =
    lang ?? (typeof document !== "undefined" ? document.documentElement.lang : "es");
  return current.startsWith("es");
}

function sameConfig(a: AnalysisConfig, b: AnalysisConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Controller: analysis config is the model; URL (path + ?c=) is persistence.
 * Pathname wins for `view` when it disagrees with the permalink payload.
 */
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [config, setConfigState] = useState<AnalysisConfig>(() => {
    const view = viewFromPath(location.pathname);
    const focusVariable = focusVariableFromPath(location.pathname);
    if (location.search.includes("c=")) {
      return {
        ...parseConfigFromSearch(location.search),
        view,
        ...(focusVariable ? { focusVariable } : {}),
      };
    }
    return (
      loadProjectFromStorage() ?? {
        ...DEFAULT_CONFIG,
        view,
        ...(focusVariable ? { focusVariable } : {}),
      }
    );
  });
  const [activeProject, setActiveProject] = useState<AtlasProject | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] =
    useState<AnalysisContextValue["saveStatus"]>("idle");
  const configRef = useRef(config);
  configRef.current = config;
  const activeRef = useRef(activeProject);
  activeRef.current = activeProject;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const savingRef = useRef(false);
  const restoredRef = useRef(false);

  // F5: reopen last active project (localStorage + cookie backup).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const id = readActiveProjectId();
    if (!id) return;
    let cancelled = false;
    void getProject(id).then((p) => {
      if (cancelled || !p) return;
      setActiveProject(p);
      writeActiveProjectId(p.id);
      setDirty(false);
      setSaveStatus("saved");
      const lang = configRef.current.lang ?? p.config.lang;
      const view = viewFromPath(location.pathname);
      // Keep current view if already on a project route; else preferred.
      const nextView =
        view === "datos" || view === "variables" || view === "analisis"
          ? view
          : preferredProjectView(p.config);
      setConfigState({
        ...p.config,
        view: nextView,
        ...(lang ? { lang } : {}),
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  useEffect(() => {
    const view = viewFromPath(location.pathname);
    const focusVariable = focusVariableFromPath(location.pathname);

    if (!location.search.includes("c=")) {
      setConfigState((prev) => {
        const next = {
          ...prev,
          view,
          ...(focusVariable
            ? { focusVariable }
            : view === "data_variable"
              ? {}
              : { focusVariable: undefined }),
        };
        return sameConfig(prev, next) ? prev : next;
      });
      return;
    }

    const parsed = parseConfigFromSearch(location.search);
    const next: AnalysisConfig = {
      ...parsed,
      view,
      ...(focusVariable ? { focusVariable } : {}),
    };
    setConfigState((prev) => (sameConfig(prev, next) ? prev : next));

    if (
      parsed.view !== view ||
      (focusVariable && parsed.focusVariable !== focusVariable)
    ) {
      const pathname = pathForView(view, next.focusVariable);
      navigate(
        {
          pathname,
          search: configToSearch(next),
          // Keep Fuentes y datos tab (#explorar, …) when the path stays put.
          ...(pathname === location.pathname && location.hash
            ? { hash: location.hash }
            : {}),
        },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  const commit = useCallback(
    (next: AnalysisConfig, opts?: { markDirty?: boolean; hash?: string }) => {
      if (sameConfig(configRef.current, next) && opts?.hash === undefined) {
        return;
      }
      setConfigState(next);
      if (opts?.markDirty !== false) setDirty(true);
      const pathname = pathForView(next.view, next.focusVariable);
      const samePath = pathname === location.pathname;
      let hash: string | undefined;
      if (opts?.hash !== undefined) {
        hash = opts.hash
          ? opts.hash.startsWith("#")
            ? opts.hash
            : `#${opts.hash}`
          : "";
      } else if (samePath) {
        hash = location.hash || undefined;
      } else {
        hash = "";
      }
      navigate({
        pathname,
        search: configToSearch(next),
        ...(hash !== undefined ? { hash } : {}),
      });
    },
    [navigate, location.pathname, location.hash],
  );

  const setConfig = useCallback(
    (patch: Partial<AnalysisConfig>, opts?: { markDirty?: boolean; hash?: string }) => {
      commit({ ...configRef.current, ...patch, v: 1 }, opts);
    },
    [commit],
  );

  const replaceConfig = useCallback(
    (next: AnalysisConfig, opts?: { markDirty?: boolean; hash?: string }) => {
      commit({ ...next, v: 1 }, opts);
    },
    [commit],
  );

  const setView = useCallback(
    (view: ViewId, opts?: { markDirty?: boolean; hash?: string }) => {
      commit({ ...configRef.current, view, v: 1 }, { markDirty: false, ...opts });
    },
    [commit],
  );

  const setLang = useCallback(
    (lang: "en" | "es") => {
      commit({ ...configRef.current, lang, v: 1 }, { markDirty: false });
    },
    [commit],
  );

  const persistNow = useCallback(
    async (opts?: { label?: string; silent?: boolean }) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaveStatus("saving");
      const es = uiIsSpanish(configRef.current.lang);
      try {
        const name =
          opts?.label?.trim() ||
          activeRef.current?.name ||
          defaultNameFromConfig(configRef.current) ||
          (es ? "Proyecto nuevo" : "New project");
        // Incomplete drafts are valid: origin/product/year may be missing.
        const proj = projectFromConfig(configRef.current, name, activeRef.current);
        saveDraft(proj);
        const saved = await persistActiveProject(proj);
        setActiveProject(saved);
        writeActiveProjectId(saved.id);
        setDirty(false);
        if (saved.teamSync === "local_fallback") {
          setSaveStatus("error");
          toast.push(
            es
              ? "No se ha podido guardar en el equipo. Está guardado en este navegador. Reintentar"
              : "Could not save to the team. Saved in this browser. Retry",
          );
          return;
        }
        setSaveStatus(saved.teamSync === "ok" ? "saved_team" : "saved");
        if (!opts?.silent) {
          toast.push(es ? "Proyecto guardado" : "Project saved");
        }
      } catch (err) {
        setSaveStatus("error");
        const msg =
          err instanceof Error && err.message.trim()
            ? err.message
            : es
              ? "No se ha podido guardar"
              : "Could not save";
        toast.push(msg);
      } finally {
        savingRef.current = false;
      }
    },
    [toast],
  );

  // Autosave 1 s after each dirty change (Prompt 4b).
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      void persistNow({ silent: true });
    }, 1000);
    return () => window.clearTimeout(t);
  }, [dirty, config, persistNow]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Ctrl/Cmd+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      void persistNow();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persistNow]);

  const value = useMemo<AnalysisContextValue>(
    () => ({
      config,
      setConfig,
      replaceConfig,
      setView,
      setLang,
      activeProject,
      dirty,
      saveStatus,
      saveProject: async (label) => {
        await persistNow(
          label !== undefined ? { label, silent: false } : { silent: false },
        );
      },
      exportProject: () => {
        if (activeRef.current) {
          const merged = projectFromConfig(
            configRef.current,
            activeRef.current.name,
            activeRef.current,
          );
          return exportProjectJson(merged.config, merged.name);
        }
        return exportProjectJson(configRef.current);
      },
      importProject: (json) => {
        void (async () => {
          try {
            const imported = importAtlasProjectJson(json);
            const project = prepareImportedProject(
              imported,
              uiIsSpanish(configRef.current.lang) ? "importado" : "imported",
            );
            const saved = await upsertProject(project);
            setActiveProject(saved);
            writeActiveProjectId(saved.id);
            setDirty(false);
            setSaveStatus(
              saved.teamSync === "ok"
                ? "saved_team"
                : saved.teamSync === "local_fallback"
                  ? "error"
                  : "saved",
            );
            commit(
              { ...saved.config, view: configRef.current.view },
              { markDirty: false },
            );
            toast.push(
              uiIsSpanish(configRef.current.lang)
                ? "Proyecto importado"
                : "Project imported",
            );
          } catch {
            commit(importProjectJson(json), { markDirty: false });
            toast.push(
              uiIsSpanish(configRef.current.lang)
                ? "Proyecto importado"
                : "Project imported",
            );
          }
        })();
      },
      openProject: (project, view = "analisis") => {
        setActiveProject(project);
        writeActiveProjectId(project.id);
        setDirty(false);
        setSaveStatus("saved");
        // The UI language is a user preference, not a project property.
        const lang = configRef.current.lang ?? project.config.lang;
        commit(
          { ...project.config, view, ...(lang ? { lang } : {}) },
          { markDirty: false },
        );
      },
      clearActiveProject: () => {
        setActiveProject(null);
        writeActiveProjectId(null);
        setDirty(false);
        setSaveStatus("idle");
      },
    }),
    [
      config,
      setConfig,
      replaceConfig,
      setView,
      setLang,
      activeProject,
      dirty,
      saveStatus,
      persistNow,
      commit,
      toast,
    ],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
