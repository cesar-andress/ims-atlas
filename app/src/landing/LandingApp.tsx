import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import {
  landingCopy,
  readLandingLang,
  storeLandingLang,
  type LandingLang,
} from "./i18n";
import { HomeLanding } from "./pages/HomeLanding";
import { MetodologiaPage } from "./pages/MetodologiaPage";
import { PrivacidadPage } from "./pages/PrivacidadPage";
import { AvisoLegalPage } from "./pages/AvisoLegalPage";
import "./landing.css";

const ENTER_HREF = "/projects";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("ims-atlas.theme", theme);
  } catch {
    /* ignore */
  }
}

function readTheme(): "light" | "dark" {
  try {
    const t = localStorage.getItem("ims-atlas.theme");
    if (t === "dark" || t === "light") return t;
  } catch {
    /* ignore */
  }
  return "light";
}

function Shell({
  lang,
  setLang,
  theme,
  setTheme,
}: {
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
}) {
  const copy = useMemo(() => landingCopy(lang), [lang]);
  const [params] = useSearchParams();
  const showLoginHint =
    params.get("aviso") === "login" || params.get("aviso") === "sesion";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title =
      lang === "es"
        ? "IMS Atlas — Selección de mercados internacionales"
        : "IMS Atlas — International market selection";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        lang === "es"
          ? "Herramienta de selección de mercados internacionales con metodología multicriterio revisada por pares."
          : "International market selection tool with a peer-reviewed multicriteria methodology.",
      );
    }
  }, [lang]);

  return (
    <>
      <header className="l-header">
        <div className="l-wrap l-header-inner">
          <Link className="l-brand" to="/" data-testid="landing-brand">
            {copy.brand}
          </Link>
          <nav className="l-nav" aria-label={lang === "es" ? "Principal" : "Main"}>
            <Link to="/metodologia">{copy.navMethod}</Link>
            <button
              type="button"
              className="l-lang"
              aria-pressed={lang === "es"}
              onClick={() => setLang("es")}
            >
              ES
            </button>
            <button
              type="button"
              className="l-lang"
              aria-pressed={lang === "en"}
              onClick={() => setLang("en")}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={theme === "light" ? copy.themeDark : copy.themeLight}
            >
              {theme === "light" ? copy.themeDark : copy.themeLight}
            </button>
            <a
              className="l-btn l-btn-primary"
              href={ENTER_HREF}
              data-testid="landing-enter-header"
            >
              {copy.navEnter}
            </a>
          </nav>
        </div>
      </header>

      <main>
        <Routes>
          <Route
            path="/"
            element={<HomeLanding copy={copy} showLoginHint={showLoginHint} />}
          />
          <Route
            path="/metodologia"
            element={<MetodologiaPage copy={copy} lang={lang} />}
          />
          <Route path="/privacidad" element={<PrivacidadPage lang={lang} />} />
          <Route path="/aviso-legal" element={<AvisoLegalPage lang={lang} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="l-footer">
        <div className="l-wrap l-footer-row">
          <p>{copy.footerDev}</p>
          <nav aria-label={lang === "es" ? "Pie" : "Footer"}>
            <Link to="/privacidad">{copy.navPrivacy}</Link>
            <Link to="/aviso-legal">{copy.navLegal}</Link>
            <Link to="/metodologia">{copy.navMethod}</Link>
            <a href={ENTER_HREF}>{copy.navEnter}</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

export function LandingApp() {
  const [lang, setLangState] = useState<LandingLang>(() => readLandingLang());
  const [theme, setThemeState] = useState<"light" | "dark">(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setLang = (l: LandingLang) => {
    storeLandingLang(l);
    setLangState(l);
  };

  return <Shell lang={lang} setLang={setLang} theme={theme} setTheme={setThemeState} />;
}
