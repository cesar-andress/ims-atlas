import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { applyTheme, readStoredTheme, type ThemeMode } from "./theme";

const REPO_URL = "https://github.com/cesar-andress/ims-atlas";
const BACKTEST_URL = "https://github.com/cesar-andress/ims-backtest";

export function App() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof document === "undefined" ? "light" : readStoredTheme(),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="shell">
      <header className="topbar" data-testid="site-header">
        <div className="brand">{t("appName")}</div>
        <div className="controls">
          <label>
            {t("language")}{" "}
            <select
              aria-label={t("language")}
              value={i18n.language.startsWith("es") ? "es" : "en"}
              onChange={(event) => {
                void i18n.changeLanguage(event.target.value);
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
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
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
