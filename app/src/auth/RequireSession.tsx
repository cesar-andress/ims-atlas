import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAccessSession } from "./accessSession";

/**
 * Defense in depth: if the SPA loads without a session, send the browser to the
 * public landing with a clear message. Caddy still enforces Authelia on the edge.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status } = useAccessSession();
  const location = useLocation();

  useEffect(() => {
    if (status !== "anonymous") return;
    const next = `${location.pathname}${location.search}`;
    const target = `/?aviso=login&next=${encodeURIComponent(next)}`;
    window.location.replace(target);
  }, [status, location.pathname, location.search]);

  if (status === "loading") {
    return (
      <div
        role="status"
        style={{ padding: "2rem", fontFamily: "system-ui,sans-serif" }}
        data-testid="session-loading"
      >
        …
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <div
        role="status"
        style={{ padding: "2rem", fontFamily: "system-ui,sans-serif" }}
        data-testid="session-redirect"
      >
        Inicia sesión para acceder
      </div>
    );
  }

  // authenticated | ungated
  return <>{children}</>;
}
