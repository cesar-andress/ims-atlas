import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AppUpdateBanner } from "./AppUpdateBanner";
import { PermalinkLink } from "./PermalinkLink";
import { AccessMenu } from "./AccessMenu";
import { LangSwitch } from "./LangSwitch";
import { ProjectBar } from "./ProjectBar";
import { TeamAccessBanner } from "./TeamAccessBanner";
import { HelpDrawer } from "./HelpDrawer";
import { useHelp } from "../help/helpContext";
import { VIEW_HELP_SECTION } from "../help/docsSections";
import { useAnalysis } from "../state/useAnalysis";
import { isProjectScreen } from "../state/views";
import { ensureLanguage, useTranslation } from "../i18n";

const REPO_URL = "https://github.com/cesar-andress/ims-atlas";

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="var(--primary)" strokeWidth="2" />
      <path
        d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20"
        stroke="var(--primary)"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** Header button that opens the project list (Home) and names the open project. */
function ProjectSwitcher() {
  const { t } = useTranslation();
  const { config, activeProject } = useAnalysis();
  const name =
    activeProject?.name ??
    (isProjectScreen(config.view) ? t("projectUntitled") : t("projectChoose"));
  return (
    <PermalinkLink
      view="home"
      className="switch"
      data-testid="project-switcher"
      aria-label={t("projectSwitch")}
    >
      <small>{t("project")}</small>
      <b data-testid="header-project-name">{name}</b>
      <span aria-hidden="true">▾</span>
    </PermalinkLink>
  );
}

/** View: one-row site header (logo, project switcher, help, language, team login). */
export function AppHeader() {
  const { t, i18n } = useTranslation();
  const { config } = useAnalysis();
  const { openHelp } = useHelp();

  useEffect(() => {
    const current = i18n.language.startsWith("es") ? "es" : "en";
    if (config.lang && config.lang !== current) {
      void ensureLanguage(config.lang);
    }
  }, [config.lang, i18n.language]);

  return (
    <header className="top" data-testid="site-header">
      <div className="wrap">
        <PermalinkLink view="home" className="logo" aria-label={t("homeAria")}>
          <Logo />
          {t("appName")}
        </PermalinkLink>
        <ProjectSwitcher />
        <span className="spacer" />
        <button
          type="button"
          className="btn ghost"
          data-testid="help-open"
          onClick={() => openHelp(VIEW_HELP_SECTION[config.view] ?? "getting_started")}
        >
          {t("helpButton")}
        </button>
        <LangSwitch />
        <AccessMenu />
      </div>
    </header>
  );
}

const FOOTER_PLACEHOLDER_MARKERS = [
  "[project name/code]",
  "[nombre/código del proyecto]",
];

export function AppFooter() {
  const { t } = useTranslation();
  const credit = t("footerCredit");
  const placeholder = FOOTER_PLACEHOLDER_MARKERS.some((m) => credit.includes(m));
  return (
    <footer className="site-footer" data-testid="site-footer">
      <div className="wrap">
        <p className="muted small" data-testid="footer-atlas-credit">
          © IMS Atlas · atlas.aiserv.es · AISERV SYSTEMS SLU
        </p>
        <p
          data-testid={placeholder ? "footer-rd-blocker" : "footer-credit"}
          {...(placeholder ? { "data-blocker": "rd-project-name" } : {})}
        >
          {credit}
        </p>
        <nav aria-label={t("footerNav")} data-testid="footer-links">
          <PermalinkLink
            view="data_sources"
            hash="fuentes"
            data-testid="footer-sources"
          >
            {t("footerSources")}
          </PermalinkLink>
          <PermalinkLink
            view="data_sources"
            hash="novedades"
            data-testid="footer-updates"
          >
            {t("footerUpdates")}
          </PermalinkLink>
          <PermalinkLink view="cite" data-testid="footer-cite">
            {t("footerCite")}
          </PermalinkLink>
          <PermalinkLink view="docs" data-testid="footer-docs">
            {t("footerDocs")}
          </PermalinkLink>
          <Link to="/privacidad" data-testid="footer-privacy">
            {t("nav.privacy")}
          </Link>
          <a href={REPO_URL} rel="noopener noreferrer" target="_blank">
            {t("footerRepo")}
          </a>
        </nav>
      </div>
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
  const { t } = useTranslation();
  const { config } = useAnalysis();
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t("skipToContent")}
      </a>
      <AppUpdateBanner />
      <AppHeader />
      <TeamAccessBanner />
      {isProjectScreen(config.view) ? <ProjectBar /> : null}
      <div className={`workspace ${showConfig ? "with-config" : ""}`}>
        {showConfig ? configSlot : null}
        <main id="main-content" tabIndex={-1}>
          <p className="mobile-readonly-banner" data-testid="mobile-readonly">
            {t("mobileReadOnly")}
          </p>
          {children}
        </main>
      </div>
      <AppFooter />
      <HelpDrawer />
    </div>
  );
}
