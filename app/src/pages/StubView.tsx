import { useTranslation } from "../i18n";
import type { ViewId } from "../state/schema";
import { PageShell } from "../components/PageShell";

type Props = {
  view: ViewId;
};

export function StubView({ view }: Props) {
  const { t } = useTranslation();
  return (
    <PageShell testId={`stub-${view}`} titleKey={`nav.${view}`} className="stub">
      <p className="muted">{t("stubSoon")}</p>
    </PageShell>
  );
}
