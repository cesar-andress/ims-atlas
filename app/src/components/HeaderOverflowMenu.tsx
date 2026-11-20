import { useEffect, useState } from "react";
import { PermalinkLink } from "./PermalinkLink";
import { GlobalSearch } from "./GlobalSearch";
import { useAnalysis } from "../state/useAnalysis";
import { ensureLanguage, useTranslation } from "../i18n";
import { applyTheme, readStoredTheme, type ThemeMode } from "../theme";

/** Language, theme, search and docs in a compact “···” menu (GUI-0 header). */
export function HeaderOverflowMenu() {
  const { t, i18n } = useTranslation();
  const { setConfig } = useAnalysis();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof document === "undefined" ? "light" : readStoredTheme(),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="header-overflow" data-testid="header-overflow">
      <button
        type="button"
        className="btn btn-secondary"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="header-overflow-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open ? (
        <div
          className="header-overflow-panel"
          role="menu"
          data-testid="header-overflow-panel"
        >
          <GlobalSearch />
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
            onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? t("themeDark") : t("themeLight")}
          </button>
          <PermalinkLink view="docs" onClick={() => setOpen(false)}>
            {t("nav.docs")}
          </PermalinkLink>
          <PermalinkLink view="cite" onClick={() => setOpen(false)}>
            {t("nav.cite")}
          </PermalinkLink>
          <PermalinkLink view="design" onClick={() => setOpen(false)}>
            {t("nav.design")}
          </PermalinkLink>
        </div>
      ) : null}
    </div>
  );
}
