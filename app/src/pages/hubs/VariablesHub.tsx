import { useEffect, useState } from "react";
import { ConfigPanel } from "../../components/ConfigPanel";
import { PermalinkLink } from "../../components/PermalinkLink";
import { VariablesGuidedChrome } from "../../components/VariablesGuidedChrome";
import { VariablesSummaryBar } from "../../components/VariablesSummaryBar";
import { useTranslation } from "../../i18n";

const EXPERT_KEY = "ims-atlas.variables.expert";

/**
 * VARIABLES = the single "Cambiar análisis" place (full page, not a side panel).
 */
export function VariablesHub() {
  const { t } = useTranslation();
  const [expert, setExpert] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(EXPERT_KEY) === "1";
  });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(EXPERT_KEY, expert ? "1" : "0");
  }, [expert]);

  return (
    <section
      className={`variables-hub${expert ? " variables-hub-expert" : " variables-hub-guided"}`}
      data-testid="variables-hub"
      data-expert={expert ? "1" : "0"}
      data-guided-step={expert ? "all" : String(step)}
    >
      <header className="variables-hub-header">
        <h1>{t("nav.variables")}</h1>
        <p className="muted">{t("hubVariablesIntro")}</p>
        <p className="muted small">
          <PermalinkLink view="analisis">{t("nav.analisis")}</PermalinkLink>
          {" · "}
          <PermalinkLink view="datos">{t("nav.datos")}</PermalinkLink>
        </p>
      </header>
      <VariablesSummaryBar />
      <VariablesGuidedChrome
        step={step}
        expert={expert}
        onStep={setStep}
        onExpert={setExpert}
      />
      <ConfigPanel layout="page" guidedStep={expert ? "all" : step} />
    </section>
  );
}
