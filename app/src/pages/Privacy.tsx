import { PageShell } from "../components/PageShell";
import { useTranslation } from "../i18n";
import { loadAccessConfig } from "../auth/accessConfig";
import { useAsyncResource } from "../state/useAsyncResource";

export function Privacy() {
  const { t } = useTranslation();
  const { data: config } = useAsyncResource(() => loadAccessConfig(), []);
  const adminMailto = config?.admin_mailto;

  return (
    <PageShell
      testId="privacy-view"
      titleKey="nav.privacy"
      intro={t("privacy.intro")}
      className="privacy-page"
    >
      <section data-testid="privacy-authelia">
        <h2>{t("privacy.autheliaTitle")}</h2>
        <p>{t("privacy.autheliaBody")}</p>
        <ul>
          <li>{t("privacy.store.username")}</li>
          <li>{t("privacy.store.name")}</li>
          <li>{t("privacy.store.email")}</li>
          <li>{t("privacy.store.passwordHash")}</li>
          <li>{t("privacy.store.totp")}</li>
          <li>{t("privacy.store.loginTimestamps")}</li>
        </ul>
      </section>

      <section data-testid="privacy-access">
        <h2>{t("privacy.whoTitle")}</h2>
        <p>{t("privacy.whoBody")}</p>
      </section>

      <section data-testid="privacy-deletion">
        <h2>{t("privacy.deletionTitle")}</h2>
        <p>
          {t("privacy.deletionBody")}{" "}
          {adminMailto ? (
            <a href={adminMailto}>{t("privacy.deletionLink")}</a>
          ) : (
            t("privacy.deletionLink")
          )}
          .
        </p>
      </section>

      <section data-testid="privacy-analytics">
        <h2>{t("privacy.analyticsTitle")}</h2>
        <p>{t("privacy.analyticsBody")}</p>
      </section>
    </PageShell>
  );
}
