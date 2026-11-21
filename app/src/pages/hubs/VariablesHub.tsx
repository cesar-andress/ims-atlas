import { ConfigPanel } from "../../components/ConfigPanel";
import { CriterionWeights } from "../../components/CriterionWeights";
import { MethodFamilyBar } from "../../components/MethodFamilyBar";
import { useTranslation } from "../../i18n";

/**
 * Step 2, Variables y pesos: method family once at the top, criterion weight
 * cards, then ONE collapsed "Opciones del método" block (Prompt 4b). Origin,
 * product and year are edited only from the project bar chips.
 */
export function VariablesHub() {
  const { t } = useTranslation();
  return (
    <section className="variables-hub" data-testid="variables-hub">
      <header className="variables-hub-header">
        <h1>{t("varsTitle")}</h1>
        <p className="lead">{t("varsLead")}</p>
      </header>
      <MethodFamilyBar />
      <CriterionWeights />
      <details className="variables-more" data-testid="variables-more">
        <summary>{t("varsMore")}</summary>
        <ConfigPanel layout="page" />
      </details>
    </section>
  );
}
