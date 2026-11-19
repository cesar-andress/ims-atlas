import type { ReactNode } from "react";
import { useTranslation } from "../i18n";

type Props = {
  testId: string;
  titleKey: string;
  intro?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
};

/** Shared page chrome: section + h1 + optional intro (Catalog, Stub, Builder, Home). */
export function PageShell({ testId, titleKey, intro, className, children }: Props) {
  const { t } = useTranslation();
  const titleId = testId === "home-view" ? "home-title" : `${testId}-title`;
  return (
    <section className={className} data-testid={testId} aria-labelledby={titleId}>
      <h1 id={titleId}>{t(titleKey)}</h1>
      {intro ? <p className="muted">{intro}</p> : null}
      {children}
    </section>
  );
}
