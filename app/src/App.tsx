import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Route, Routes } from "react-router-dom";
import { ConfigPanel } from "./components/ConfigPanel";
import { Builder } from "./pages/Builder";
import { Catalog } from "./pages/Catalog";
import { Home } from "./pages/Home";
import { Ranking } from "./pages/Ranking";
import { StubView } from "./pages/StubView";
import { AnalysisProvider } from "./state/AnalysisContext";
import { useAnalysis } from "./state/useAnalysis";
import type { ViewId } from "./state/schema";
import { applyTheme, readStoredTheme, type ThemeMode } from "./theme";

const REPO_URL = "https://github.com/cesar-andress/ims-atlas";
const BACKTEST_URL = "https://github.com/cesar-andress/ims-backtest";

const NAV: ViewId[] = [
  "home",
  "catalog",
  "builder",
  "ranking",
  "matrix",
  "map",
  "uncertainty",
  "backtest",
  "time",
  "cite",
  "byod",
  "docs",
];

function AppShell() {
  const { t, i18n } = useTranslation();
  const { config, setView, setConfig } = useAnalysis();
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof document === "undefined" ? "light" : readStoredTheme(),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (config.lang && config.lang !== (i18n.language.startsWith("es") ? "es" : "en")) {
      void i18n.changeLanguage(config.lang);
    }
  }, [config.lang, i18n]);

  const showConfig = config.view !== "home" && config.view !== "docs";

  return (
    <div className="shell">
      <header className="topbar" data-testid="site-header">
        <div className="brand">
          <Link to="/" onClick={() => setView("home")}>
            {t("appName")}
          </Link>
        </div>
        <nav className="main-nav" aria-label={t("mainNav")} data-testid="main-nav">
          {NAV.map((view) => (
            <Link
              key={view}
              to={view === "home" ? "/" : `/${view}`}
              className={config.view === view ? "active" : undefined}
              onClick={() => setView(view)}
            >
              {t(`nav.${view}`)}
            </Link>
          ))}
        </nav>
        <div className="controls">
          <label>
            {t("language")}{" "}
            <select
              aria-label={t("language")}
              value={i18n.language.startsWith("es") ? "es" : "en"}
              onChange={(event) => {
                const lang = event.target.value as "en" | "es";
                void i18n.changeLanguage(lang);
                setConfig({ lang });
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
      <div className={`workspace ${showConfig ? "with-config" : ""}`}>
        {showConfig ? <ConfigPanel /> : null}
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/builder" element={<Builder />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/matrix" element={<StubView view="matrix" />} />
            <Route path="/map" element={<StubView view="map" />} />
            <Route path="/uncertainty" element={<StubView view="uncertainty" />} />
            <Route path="/backtest" element={<StubView view="backtest" />} />
            <Route path="/time" element={<StubView view="time" />} />
            <Route path="/cite" element={<StubView view="cite" />} />
            <Route path="/byod" element={<StubView view="byod" />} />
            <Route path="/docs" element={<StubView view="docs" />} />
          </Routes>
        </main>
      </div>
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
    </div>
  );
}

export function App() {
  return (
    <AnalysisProvider>
      <AppShell />
    </AnalysisProvider>
  );
}
