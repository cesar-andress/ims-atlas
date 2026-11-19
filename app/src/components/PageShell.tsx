import type { ReactNode } from "react";
import { useTranslation } from "../i18n";

type Props = {
  testId: string;
  titleKey: string;
  intro?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
};

/** Shared page chrome: section + h1 + optional intro (Catalog, Stub, Builder, …). */
export function PageShell({ testId, titleKey, intro, className, children }: Props) {
  const { t } = useTranslation();
  return (
    <section
      className={className}
      data-testid={testId}
      aria-labelledby={`${testId}-title`}
    >
      <h1 id={`${testId}-title`}>{t(titleKey)}</h1>
      {intro ? <p className="muted">{intro}</p> : null}
      {children}
    </section>
  );
}
