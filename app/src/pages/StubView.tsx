import { useTranslation } from "react-i18next";
import type { ViewId } from "../state/schema";

type Props = {
  view: ViewId;
};

export function StubView({ view }: Props) {
  const { t } = useTranslation();
  return (
    <section className="stub" data-testid={`stub-${view}`}>
      <h1>{t(`nav.${view}`)}</h1>
      <p className="muted">{t("stubSoon")}</p>
    </section>
  );
}
