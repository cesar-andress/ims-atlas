import { ConfigPanel } from "../../components/ConfigPanel";
import { CriterionWeights } from "../../components/CriterionWeights";
import { useTranslation } from "../../i18n";

/**
 * Step 2, Variables y pesos: criterion cards with weight sliders, then ONE collapsed
 * "Más opciones" block with the remaining method controls. Origin, product and year
 * are edited only from the project bar chips.
 */
export function VariablesHub() {
  const { t } = useTranslation();
  return (
    <section className="variables-hub" data-testid="variables-hub">
      <header className="variables-hub-header">
        <h1>{t("varsTitle")}</h1>
        <p className="lead">{t("varsLead")}</p>
      </header>
      <CriterionWeights />
      <details className="variables-more" data-testid="variables-more">
        <summary>{t("varsMore")}</summary>
        <ConfigPanel layout="page" />
      </details>
    </section>
  );
}
