import { useTranslation } from "../i18n";

/** Red banner when published /status came from a fixture (mini_world) run. */
export function FixtureStatusBanner({
  isFixture,
  message = null,
}: {
  isFixture: boolean;
  message?: string | null;
}) {
  const { t } = useTranslation();
  if (!isFixture) return null;
  return (
    <p
      className="fixture-status-banner"
      role="alert"
      data-testid="fixture-status-banner"
    >
      {message && message.trim().length > 0 ? message : t("fixtureStatusBanner")}
    </p>
  );
}
