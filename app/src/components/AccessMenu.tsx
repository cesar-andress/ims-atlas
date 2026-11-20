import { useCallback, useEffect, useRef, useState } from "react";
import {
  atlasHomeUrl,
  loadAccessConfig,
  type AccessConfig,
} from "../auth/accessConfig";
import { useAccessSession } from "../auth/accessSession";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { PermalinkLink } from "./PermalinkLink";

function loginUrl(portalUrl: string): string {
  const rd = encodeURIComponent(
    typeof window !== "undefined" ? window.location.href : atlasHomeUrl(),
  );
  const base = portalUrl.replace(/\/$/, "");
  return `${base}/?rd=${rd}`;
}

function logoutUrl(portalUrl: string): string {
  const rd = encodeURIComponent(atlasHomeUrl());
  const base = portalUrl.replace(/\/$/, "");
  return `${base}/logout?rd=${rd}`;
}

export function AccessMenu() {
  const { t } = useTranslation();
  const { status, profile, sessionExpired, dismissSessionExpired } = useAccessSession();
  const { config: analysis } = useAnalysis();
  const [config, setConfig] = useState<AccessConfig | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    void loadAccessConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = detailsRef.current;
      if (!el?.open) return;
      if (!el.contains(e.target as Node)) el.open = false;
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onLogin = useCallback(() => {
    if (!config) return;
    window.location.assign(loginUrl(config.auth.portal_url));
  }, [config]);

  const onLogout = useCallback(() => {
    if (!config) return;
    window.location.assign(logoutUrl(config.auth.portal_url));
  }, [config]);

  function closeMenu() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  const onToolsPage = analysis.view === "advanced_tools";

  return (
    <div className="access-menu" data-testid="access-menu">
      {sessionExpired ? (
        <p
          className="access-toast"
          role="status"
          data-testid="access-session-expired-toast"
        >
          <span>{t("access.sessionExpired")}</span>
          <button type="button" onClick={onLogin} disabled={!config}>
            {t("access.login")}
          </button>
          <button
            type="button"
            className="access-toast-dismiss"
            onClick={dismissSessionExpired}
            aria-label={t("access.dismissToast")}
          >
            ×
          </button>
        </p>
      ) : null}

      {status === "loading" ? (
        <span className="access-menu-muted small" aria-hidden>
          …
        </span>
      ) : status === "anonymous" ? (
        <button
          type="button"
          className="access-login-btn"
          data-testid="access-login"
          onClick={onLogin}
          disabled={!config}
        >
          {t("access.login")}
        </button>
      ) : status === "ungated" ? (
        <span className="access-menu-muted small" data-testid="access-ungated" />
      ) : (
        <details className="access-user-menu" ref={detailsRef}>
          <summary className="access-user-summary">
            <span className="access-user-name">{profile?.name ?? profile?.user}</span>
            <span className="access-team-badge" data-testid="access-badge">
              {t("access.teamBadge")}
            </span>
          </summary>
          <ul className="access-user-actions">
            {!onToolsPage ? (
              <li>
                <PermalinkLink
                  view="advanced_tools"
                  data-testid="team-tools-link"
                  onClick={closeMenu}
                >
                  {t("nav.advanced_tools")}
                </PermalinkLink>
              </li>
            ) : null}
            <li>
              <button type="button" onClick={onLogout} disabled={!config}>
                {t("access.logout")}
              </button>
            </li>
          </ul>
        </details>
      )}
    </div>
  );
}
