import { useEffect, useRef } from "react";
import { useHelp } from "../help/helpContext";
import { useTranslation } from "../i18n";
import { PermalinkLink } from "./PermalinkLink";

/** Side drawer with a short help blurb + link to the full docs section. */
export function HelpDrawer() {
  const { t } = useTranslation();
  const { section, closeHelp } = useHelp();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!section) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [section, closeHelp]);

  if (!section) return null;

  return (
    <div className="help-drawer-root" data-testid="help-drawer">
      <button
        type="button"
        className="help-drawer-backdrop"
        aria-label={t("helpClose")}
        onClick={closeHelp}
      />
      <aside
        className="help-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
      >
        <header className="help-drawer-header">
          <h2 id="help-drawer-title">{t(`docs.section.${section}`)}</h2>
          <button
            ref={closeRef}
            type="button"
            data-testid="help-drawer-close"
            onClick={closeHelp}
          >
            {t("helpClose")}
          </button>
        </header>
        <div className="help-drawer-body">
          <p>{t(`docs.helpBlurb.${section}`)}</p>
          <p>
            <PermalinkLink
              view="docs"
              hash={`docs-${section}`}
              data-testid="help-drawer-docs-link"
              onClick={closeHelp}
            >
              {t("helpReadMore")}
            </PermalinkLink>
          </p>
        </div>
      </aside>
    </div>
  );
}
