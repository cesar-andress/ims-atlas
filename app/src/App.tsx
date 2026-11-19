import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { AppNav } from "./components/AppNav";
import { Home } from "./pages/Home";
import { StubView } from "./pages/StubView";
import { AnalysisProvider } from "./state/AnalysisContext";
import { useAnalysis } from "./state/useAnalysis";
import { isAnalysisView } from "./state/views";
import { configToSearch } from "./state/urlState";
import { ensureLanguage, useTranslation } from "./i18n";
import { applyTheme, readStoredTheme, type ThemeMode } from "./theme";

const ConfigPanel = lazy(() =>
  import("./components/ConfigPanel").then((m) => ({ default: m.ConfigPanel })),
);
const Builder = lazy(() =>
  import("./pages/Builder").then((m) => ({ default: m.Builder })),
);
const Catalog = lazy(() =>
  import("./pages/Catalog").then((m) => ({ default: m.Catalog })),
);
const Ranking = lazy(() =>
  import("./pages/Ranking").then((m) => ({ default: m.Ranking })),
);
const Matrix = lazy(() =>
  import("./pages/Matrix").then((m) => ({ default: m.Matrix })),
);
const MarketMap = lazy(() =>
  import("./pages/MarketMap").then((m) => ({ default: m.MarketMap })),
);

const REPO_URL = "https://github.com/cesar-andress/ims-atlas";
const BACKTEST_URL = "https://github.com/cesar-andress/ims-backtest";

function RouteFallback() {
  const { t } = useTranslation();
  return (
    <p className="muted" data-testid="route-loading">
      {t("loading")}
    </p>
  );
}

function AppShell() {
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

  const showConfig = isAnalysisView(config.view);

  return (
    <div className="shell">
      <header className="topbar" data-testid="site-header">
        <div className="brand">
          <Link
            to={{
              pathname: "/",
              search: configToSearch({ ...config, view: "home" }),
            }}
          >
            {t("appName")}
          </Link>
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
      <div className={`workspace ${showConfig ? "with-config" : ""}`}>
        {showConfig ? (
          <Suspense fallback={null}>
            <ConfigPanel />
          </Suspense>
        ) : null}
        <main>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/builder" element={<Builder />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/matrix" element={<Matrix />} />
              <Route path="/map" element={<MarketMap />} />
              <Route path="/uncertainty" element={<StubView view="uncertainty" />} />
              <Route path="/backtest" element={<StubView view="backtest" />} />
              <Route path="/time" element={<StubView view="time" />} />
              <Route path="/cite" element={<StubView view="cite" />} />
              <Route path="/byod" element={<StubView view="byod" />} />
              <Route path="/docs" element={<StubView view="docs" />} />
            </Routes>
          </Suspense>
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
