import type { ReactNode } from "react";
import { useTranslation } from "../i18n";
import { useEmbeddedPanel } from "./EmbeddedContext";

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
  const embedded = useEmbeddedPanel();
  const titleId = testId === "home-view" ? "home-title" : `${testId}-title`;
  return (
    <section className={className} data-testid={testId} aria-labelledby={titleId}>
      {embedded ? (
        <h2 id={titleId}>{t(titleKey)}</h2>
      ) : (
        <h1 id={titleId}>{t(titleKey)}</h1>
      )}
      {intro ? <p className="muted">{intro}</p> : null}
      {children}
    </section>
  );
}
