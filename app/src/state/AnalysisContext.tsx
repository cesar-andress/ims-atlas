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
    if (location.search.includes("c=")) {
      return { ...parseConfigFromSearch(location.search), view };
    }
    return (
      loadProjectFromStorage() ?? {
        ...DEFAULT_CONFIG,
        view,
      }
    );
  });
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const view = viewFromPath(location.pathname);

    if (!location.search.includes("c=")) {
      setConfigState((prev) => (prev.view === view ? prev : { ...prev, view }));
      return;
    }

    const parsed = parseConfigFromSearch(location.search);
    const next = { ...parsed, view };
    setConfigState((prev) => (sameConfig(prev, next) ? prev : next));

    // Permalink said another view: keep path as source of truth and rewrite ?c=.
    if (parsed.view !== view) {
      navigate(
        { pathname: pathForView(view), search: configToSearch(next) },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  const commit = useCallback(
    (next: AnalysisConfig) => {
      if (sameConfig(configRef.current, next)) return;
      setConfigState(next);
      navigate({
        pathname: pathForView(next.view),
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
