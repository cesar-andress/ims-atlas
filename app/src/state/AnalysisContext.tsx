import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfigState] = useState<AnalysisConfig>(() => {
    const fromUrl = parseConfigFromSearch(location.search);
    if (location.search.includes("c=")) return fromUrl;
    return (
      loadProjectFromStorage() ?? {
        ...DEFAULT_CONFIG,
        view: viewFromPath(location.pathname),
      }
    );
  });

  useEffect(() => {
    const view = viewFromPath(location.pathname);
    setConfigState((prev) => (prev.view === view ? prev : { ...prev, view }));
  }, [location.pathname]);

  useEffect(() => {
    if (!location.search.includes("c=")) return;
    const parsed = parseConfigFromSearch(location.search);
    setConfigState(parsed);
    if (parsed.view) {
      const target = pathForView(parsed.view);
      if (
        location.pathname !== target &&
        !(target === "/" && location.pathname === "")
      ) {
        navigate({ pathname: target, search: location.search }, { replace: true });
      }
    }
  }, [location.search, location.pathname, navigate]);

  const push = useCallback(
    (next: AnalysisConfig) => {
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
      push({ ...config, ...patch, v: 1 });
    },
    [config, push],
  );

  const setView = useCallback(
    (view: ViewId) => {
      push({ ...config, view, v: 1 });
    },
    [config, push],
  );

  const value = useMemo<AnalysisContextValue>(
    () => ({
      config,
      setConfig,
      setView,
      saveProject: (label) => {
        saveProjectToStorage(config, label);
      },
      exportProject: () => exportProjectJson(config),
      importProject: (json) => {
        const imported = importProjectJson(json);
        push(imported);
      },
    }),
    [config, push, setConfig, setView],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
