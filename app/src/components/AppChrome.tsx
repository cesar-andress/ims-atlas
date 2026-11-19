import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "./AppNav";
import { PermalinkLink } from "./PermalinkLink";
import { useAnalysis } from "../state/useAnalysis";
import { ensureLanguage, useTranslation } from "../i18n";
import { applyTheme, readStoredTheme, type ThemeMode } from "../theme";

const REPO_URL = "https://github.com/cesar-andress/ims-atlas";
const BACKTEST_URL = "https://github.com/cesar-andress/ims-backtest";

/** View: site header + footer around the workspace. */
export function AppHeader() {
  const { t, i18n } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof document === "undefined" ? "light" : readStoredTheme(),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const current = i18n.language.startsWith("es") ? "es" : "en";
    if (config.lang && config.lang !== current) {
      void ensureLanguage(config.lang);
    }
  }, [config.lang, i18n.language]);

  return (
    <header className="topbar" data-testid="site-header">
      <div className="brand">
        <PermalinkLink view="home">{t("appName")}</PermalinkLink>
      </div>
      <AppNav />
      <div className="controls">
        <label>
          {t("language")}{" "}
          <select
            aria-label={t("language")}
            value={i18n.language.startsWith("es") ? "es" : "en"}
            onChange={(event) => {
              const lang = event.target.value as "en" | "es";
              void ensureLanguage(lang).then(() => setConfig({ lang }));
            }}
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
        </label>
        <button
          type="button"
          aria-label={t("theme")}
          onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        >
          {theme === "light" ? t("themeDark") : t("themeLight")}
        </button>
      </div>
    </header>
  );
}

export function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer className="site-footer">
      <p>{t("footerCredit")}</p>
      <nav aria-label="Project links">
        <a href={REPO_URL} rel="noopener noreferrer" target="_blank">
          {t("footerRepo")}
        </a>
        <a href={BACKTEST_URL} rel="noopener noreferrer" target="_blank">
          {t("footerBacktest")}
        </a>
      </nav>
    </footer>
  );
}

export function AppShellFrame({
  showConfig,
  configSlot,
  children,
}: {
  showConfig: boolean;
  configSlot: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <AppHeader />
      <div className={`workspace ${showConfig ? "with-config" : ""}`}>
        {showConfig ? configSlot : null}
        <main>{children}</main>
      </div>
      <AppFooter />
    </div>
  );
}
