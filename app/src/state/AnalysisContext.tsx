import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnalysisContext, type AnalysisContextValue } from "./analysisContextBase";
import { DEFAULT_CONFIG, type AnalysisConfig, type ViewId } from "./schema";
import {
  configToSearch,
  focusVariableFromPath,
  parseConfigFromSearch,
  pathForView,
  viewFromPath,
} from "./urlState";
import {
  exportProjectJson,
  importProjectJson,
  loadProjectFromStorage,
  saveProjectToStorage,
} from "./projectStore";

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
  const configRef = useRef(config);
  configRef.current = config;

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

    // Permalink said another view: keep path as source of truth and rewrite ?c=.
    if (
      parsed.view !== view ||
      (focusVariable && parsed.focusVariable !== focusVariable)
    ) {
      navigate(
        {
          pathname: pathForView(view, next.focusVariable),
          search: configToSearch(next),
        },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  const commit = useCallback(
    (next: AnalysisConfig) => {
      if (sameConfig(configRef.current, next)) return;
      setConfigState(next);
      navigate({
        pathname: pathForView(next.view, next.focusVariable),
        search: configToSearch(next),
      });
    },
    [navigate],
  );

  const setConfig = useCallback(
    (patch: Partial<AnalysisConfig>) => {
      commit({ ...configRef.current, ...patch, v: 1 });
    },
    [commit],
  );

  const replaceConfig = useCallback(
    (next: AnalysisConfig) => {
      commit({ ...next, v: 1 });
    },
    [commit],
  );

  const setView = useCallback(
    (view: ViewId) => {
      commit({ ...configRef.current, view, v: 1 });
    },
    [commit],
  );

  const value = useMemo<AnalysisContextValue>(
    () => ({
      config,
      setConfig,
      replaceConfig,
      setView,
      saveProject: (label) => {
        saveProjectToStorage(configRef.current, label);
      },
      exportProject: () => exportProjectJson(configRef.current),
      importProject: (json) => {
        commit(importProjectJson(json));
      },
    }),
    [config, commit, setConfig, replaceConfig, setView],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
