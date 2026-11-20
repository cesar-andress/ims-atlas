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
  projectFromConfig,
} from "./projectStore";
import { saveDraft } from "./projectIdb";
import { upsertProject } from "./projectLibrary";
import { DEFAULT_CONFIG, type AnalysisConfig, type ViewId } from "./schema";
import {
  configToSearch,
  focusVariableFromPath,
  parseConfigFromSearch,
  pathForView,
  viewFromPath,
} from "./urlState";

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
  const configRef = useRef(config);
  configRef.current = config;
  const activeRef = useRef(activeProject);
  activeRef.current = activeProject;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

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

  // Autosave draft every 8s when dirty.
  useEffect(() => {
    if (!dirty) return;
    const t = window.setInterval(() => {
      const proj = projectFromConfig(
        configRef.current,
        activeRef.current?.name,
        activeRef.current,
      );
      saveDraft(proj);
    }, 8000);
    return () => window.clearInterval(t);
  }, [dirty]);

  // Ctrl/Cmd+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      void (async () => {
        const proj = projectFromConfig(
          configRef.current,
          activeRef.current?.name ?? defaultNameFromConfig(configRef.current),
          activeRef.current,
        );
        const saved = await persistActiveProject(proj);
        setActiveProject(saved);
        setDirty(false);
        toast.push(
          uiIsSpanish(configRef.current.lang) ? "Proyecto guardado" : "Project saved",
        );
      })();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast]);

  const value = useMemo<AnalysisContextValue>(
    () => ({
      config,
      setConfig,
      replaceConfig,
      setView,
      setLang,
      activeProject,
      dirty,
      saveProject: async (label) => {
        const name =
          label?.trim() ||
          activeRef.current?.name ||
          defaultNameFromConfig(configRef.current);
        const proj = projectFromConfig(configRef.current, name, activeRef.current);
        const saved = await persistActiveProject(proj);
        setActiveProject(saved);
        setDirty(false);
        toast.push(
          uiIsSpanish(configRef.current.lang) ? "Proyecto guardado" : "Project saved",
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
            const project = importAtlasProjectJson(json);
            const saved = await upsertProject(project);
            setActiveProject(saved);
            setDirty(false);
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
        setDirty(false);
        // The UI language is a user preference, not a project property.
        const lang = configRef.current.lang ?? project.config.lang;
        commit(
          { ...project.config, view, ...(lang ? { lang } : {}) },
          { markDirty: false },
        );
      },
      clearActiveProject: () => {
        setActiveProject(null);
        setDirty(false);
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
      commit,
      toast,
    ],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
