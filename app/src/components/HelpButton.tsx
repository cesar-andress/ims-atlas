import { useHelp } from "../help/helpContext";
import { VIEW_HELP_SECTION, type DocsSectionId } from "../help/docsSections";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

type Props = {
  /** Override the section; default = map from current view. */
  section?: DocsSectionId;
  className?: string;
};

/** Contextual "?" that opens the help drawer for a docs section. */
export function HelpButton({ section, className = "help-btn" }: Props) {
  const { t } = useTranslation();
  const { openHelp } = useHelp();
  const { config } = useAnalysis();
  const target = section ?? VIEW_HELP_SECTION[config.view];
  if (!target) return null;

  return (
    <button
      type="button"
      className={className}
      data-testid={`help-btn-${target}`}
      aria-label={t("helpOpen")}
      title={t("helpOpen")}
      onClick={() => openHelp(target)}
    >
      ?
    </button>
  );
}
