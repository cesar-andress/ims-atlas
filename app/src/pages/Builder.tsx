import { Navigate } from "react-router-dom";

/**
 * Legacy /builder route: redirect to Variables (the sole Cambiar análisis place).
 * Keeps old permalinks working without a second config UI.
 */
export function Builder() {
  const qs = typeof window !== "undefined" ? window.location.search : "";
  return <Navigate to={`/variables${qs}`} replace />;
}
