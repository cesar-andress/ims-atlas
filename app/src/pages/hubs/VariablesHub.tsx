import { ConfigPanel } from "../../components/ConfigPanel";
import { PermalinkLink } from "../../components/PermalinkLink";
import { useTranslation } from "../../i18n";

/**
 * VARIABLES = the single "Cambiar análisis" place (full page, not a side panel).
 */
export function VariablesHub() {
  const { t } = useTranslation();
  return (
    <section className="variables-hub" data-testid="variables-hub">
      <header className="variables-hub-header">
        <h1>{t("nav.variables")}</h1>
        <p className="muted">{t("hubVariablesIntro")}</p>
        <p className="muted small">
          <PermalinkLink view="analisis">{t("nav.analisis")}</PermalinkLink>
          {" · "}
          <PermalinkLink view="datos">{t("nav.datos")}</PermalinkLink>
        </p>
      </header>
      <ConfigPanel layout="page" />
    </section>
  );
}
