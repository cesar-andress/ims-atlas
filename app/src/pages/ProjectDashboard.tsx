import { Navigate } from "react-router-dom";
import { useAnalysis } from "../state/useAnalysis";
import { preferredProjectView } from "../state/views";
import { configToSearch, pathForView } from "../state/urlState";

/**
 * Legacy /project_dashboard bookmarks redirect to the modern project entry
 * (Resultados when the scope is ready, otherwise Datos).
 */
export function ProjectDashboard() {
  const { config } = useAnalysis();
  const view = preferredProjectView(config);
  const next = { ...config, view };
  return (
    <Navigate
      to={{
        pathname: pathForView(view),
        search: configToSearch(next),
      }}
      replace
    />
  );
}
