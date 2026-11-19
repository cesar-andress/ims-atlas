import { useTranslation } from "../i18n";
import { PermalinkLink } from "./PermalinkLink";

type Props = {
  detail?: string | undefined;
};

/** Shared empty-state for public release with no redistributable panel. */
export function PendingReleaseNotice({ detail }: Props) {
  const { t } = useTranslation();
  return (
    <div className="analysis-empty" role="alert" data-testid="data-release-pending">
      <p>{t("dataReleasePending")}</p>
      {detail ? <p className="muted small">{detail}</p> : null}
      <p className="analysis-actions">
        <PermalinkLink view="status">{t("nav.status")}</PermalinkLink>
        {" · "}
        <PermalinkLink view="catalog">{t("nav.catalog")}</PermalinkLink>
        {" · "}
        <PermalinkLink view="byod">{t("nav.byod")}</PermalinkLink>
        {" · "}
        <PermalinkLink view="data_releases">{t("nav.data_releases")}</PermalinkLink>
      </p>
    </div>
  );
}
