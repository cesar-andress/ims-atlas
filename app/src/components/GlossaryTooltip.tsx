import * as Tooltip from "@radix-ui/react-tooltip";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";

type Props = {
  /** Plain-language label shown inline. */
  label: string;
  /** Technical id shown in tooltip. */
  technical: string;
  /** Docs glossary anchor (without #). */
  glossaryId?: string;
};

/** Plain label + Radix tooltip with technical name and glossary link. */
export function GlossaryTooltip({ label, technical, glossaryId = "glossary" }: Props) {
  const { t } = useTranslation();
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="glossary-tip-trigger"
            data-testid={`glossary-tip-${technical}`}
          >
            {label}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="glossary-tip-content" sideOffset={6}>
            <code>{technical}</code>
            <div>
              <Link to={`/docs#${glossaryId}`}>{t("glossaryOpen")}</Link>
            </div>
            <Tooltip.Arrow className="fill-[var(--surface)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
