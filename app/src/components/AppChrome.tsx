import type { ReactNode } from "react";
import { useEffect } from "react";
import { version as APP_VERSION } from "@ims-atlas/core";
import { AppNav } from "./AppNav";
import { AppUpdateBanner } from "./AppUpdateBanner";
import { PermalinkLink } from "./PermalinkLink";
import { AccessMenu } from "./AccessMenu";
import { UpdatesNewsPill } from "./UpdatesNewsPill";
import { HeaderOverflowMenu } from "./HeaderOverflowMenu";
import { HelpDrawer } from "./HelpDrawer";
import { OnboardingTour } from "./OnboardingTour";
import { dataConfig } from "../dataConfig";
import { useAnalysis } from "../state/useAnalysis";
import { ensureLanguage, useTranslation } from "../i18n";

const REPO_URL = "https://github.com/cesar-andress/ims-atlas";
const BACKTEST_URL = "https://github.com/cesar-andress/ims-backtest";

/** View: site header + footer around the workspace. */
export function AppHeader() {
  const { t, i18n } = useTranslation();
  const { config, dirty, activeProject } = useAnalysis();

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
        {activeProject ? (
          <span className="project-name-chip" data-testid="header-project-name">
            {" · "}
            {activeProject.name}
            {dirty ? (
              <span
                className="unsaved-dot"
                data-testid="unsaved-dot"
                title={t("projectUnsaved")}
              />
            ) : null}
          </span>
        ) : dirty ? (
          <span
            className="unsaved-dot"
            data-testid="unsaved-dot"
            title={t("projectUnsaved")}
          />
        ) : null}
      </div>
      <AppNav />
      <UpdatesNewsPill />
      <div className="controls">
        <AccessMenu />
        <HeaderOverflowMenu />
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
    <footer className="site-footer">
      <p className="muted small" data-testid="footer-atlas-credit">
        © IMS Atlas · atlas.aiserv.es · AISERV SYSTEMS SLU
      </p>
      <p
        data-testid={placeholder ? "footer-rd-blocker" : "footer-credit"}
        {...(placeholder ? { "data-blocker": "rd-project-name" } : {})}
      >
        {credit}
      </p>
      <p className="muted small" data-testid="footer-versions">
        {t("appVersion")} {APP_VERSION} · {t("dataRelease")} v
        {dataConfig.release_version}
      </p>
      <nav aria-label="Project links">
        <a href={REPO_URL} rel="noopener noreferrer" target="_blank">
          {t("footerRepo")}
        </a>
        <a href={BACKTEST_URL} rel="noopener noreferrer" target="_blank">
          {t("footerBacktest")}
        </a>
        <a href="/privacidad">{t("nav.privacy")}</a>
        <a href="/changelog">{t("nav.changelog")}</a>
      </nav>
      <div className="mt-2">
        <OnboardingTour />
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
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t("skipToContent")}
      </a>
      <AppUpdateBanner />
      <AppHeader />
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
