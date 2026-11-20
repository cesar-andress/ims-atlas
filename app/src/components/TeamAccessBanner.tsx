import { useAccessSession } from "../auth/accessSession";
import { useTranslation } from "../i18n";

/** Shown when the session can read cerrada data (Phase I). */
export function TeamAccessBanner() {
  const { t } = useTranslation();
  const { status } = useAccessSession();
  if (status !== "authenticated") return null;
  return (
    <p
      className="access-toast access-internal-banner"
      role="status"
      data-testid="access-internal-banner"
    >
      {t("access.internalUseBanner")}
    </p>
  );
}
