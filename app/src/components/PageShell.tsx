import type { ReactNode } from "react";
import { useTranslation } from "../i18n";
import { useEmbeddedPanel } from "./EmbeddedContext";

type Props = {
  testId: string;
  titleKey: string;
  intro?: string | undefined;
  className?: string | undefined;
  /** When embedded under FuentesDatos, skip the duplicate H2. */
  omitTitleWhenEmbedded?: boolean | undefined;
  children: ReactNode;
};

/** Shared page chrome: section + h1 + optional intro (Catalog, Stub, Builder, Home). */
export function PageShell({
  testId,
  titleKey,
  intro,
  className,
  omitTitleWhenEmbedded = false,
  children,
}: Props) {
  const { t } = useTranslation();
  const embedded = useEmbeddedPanel();
  const titleId = testId === "home-view" ? "home-title" : `${testId}-title`;
  const showTitle = !(embedded && omitTitleWhenEmbedded);
  return (
    <section
      className={className}
      data-testid={testId}
      {...(showTitle ? { "aria-labelledby": titleId } : {})}
    >
      {showTitle ? (
        embedded ? (
          <h2 id={titleId}>{t(titleKey)}</h2>
        ) : (
          <h1 id={titleId}>{t(titleKey)}</h1>
        )
      ) : (
        <h2 id={titleId} className="visually-hidden">
          {t(titleKey)}
        </h2>
      )}
      {intro && !(embedded && omitTitleWhenEmbedded) ? (
        <p className="muted">{intro}</p>
      ) : null}
      {children}
    </section>
  );
}
