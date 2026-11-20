import * as Checkbox from "@radix-ui/react-checkbox";
import * as Label from "@radix-ui/react-label";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { GlossaryTooltip } from "./GlossaryTooltip";

/** Radix-backed toggles used on Variables (imputation on/off). */
export function VariablesRadixFields() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const checked =
    config.imputationMethod !== undefined && config.imputationMethod !== "none";

  return (
    <div className="variables-radix-fields" data-testid="variables-radix-fields">
      <div className="flex items-center gap-2">
        <Checkbox.Root
          className="radix-checkbox"
          id="impute-radix"
          checked={checked}
          data-testid="impute-radix"
          onCheckedChange={(v) =>
            setConfig({
              imputationMethod: v === true ? "linear_interp" : "none",
            })
          }
        >
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
        <Label.Root htmlFor="impute-radix">
          <GlossaryTooltip
            label={t("imputationMethod")}
            technical="imputationMethod"
            glossaryId="glossary"
          />
        </Label.Root>
      </div>
    </div>
  );
}
