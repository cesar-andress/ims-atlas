import type { ReactNode } from "react";
import { useTranslation } from "../i18n";
import type { ViewId } from "../state/schema";
import { useAnalysis } from "../state/useAnalysis";
import { useEmbeddedPanel } from "./EmbeddedContext";
import { PageShell } from "./PageShell";
import { PermalinkLink } from "./PermalinkLink";

const TRANSPARENCY_VIEWS: readonly ViewId[] = [
  "status",
  "data_sources",
  "data_variable",
  "data_pipeline",
  "data_releases",
  "data_updates",
];

type Props = {
  testId: string;
  titleKey: string;
  introKey: string;
  children: ReactNode;
};

/** Shared View shell for transparency / data pages (one nav, one layout). */
export function TransparencyShell({ testId, titleKey, introKey, children }: Props) {
  const { t } = useTranslation();
  const { config } = useAnalysis();
  const embedded = useEmbeddedPanel();

  return (
    <PageShell testId={testId} titleKey={titleKey} omitTitleWhenEmbedded>
      {embedded ? null : <p className="muted">{t(introKey)}</p>}
      {embedded ? null : (
        <nav className="transparency-nav" aria-label={t("transparencyNav")}>
          {TRANSPARENCY_VIEWS.map((view) => (
            <PermalinkLink
              key={view}
              view={view}
              className={config.view === view ? "active" : undefined}
            >
              {t(`nav.${view}`)}
            </PermalinkLink>
          ))}
        </nav>
      )}
      {children}
    </PageShell>
  );
}
