import { useTranslation } from "../i18n";
import { hsLabel } from "../data/hsProducts";
import { useAnalysis } from "../state/useAnalysis";

/** Shared read-only summary of the current analysis config (Builder + empty states). */
export function AnalysisSummary() {
  const { t, i18n } = useTranslation();
  const { config } = useAnalysis();
  const lang = i18n.language.startsWith("es") ? "es" : "en";

  return (
    <dl className="builder-summary" data-testid="builder-summary">
      <div>
        <dt>{t("origin")}</dt>
        <dd>{config.origin ?? "—"}</dd>
      </div>
      <div>
        <dt>{t("product")}</dt>
        <dd>{config.hs ? hsLabel(config.hs, lang) : "—"}</dd>
      </div>
      <div>
        <dt>{t("year")}</dt>
        <dd>{config.year ?? "—"}</dd>
      </div>
      <div>
        <dt>{t("region")}</dt>
        <dd>{config.region ?? "world"}</dd>
      </div>
      <div>
        <dt>{t("weightScheme")}</dt>
        <dd>{config.weightScheme ?? "expert_mean"}</dd>
      </div>
      <div>
        <dt>{t("normalization")}</dt>
        <dd>{config.normalization ?? "minmax"}</dd>
      </div>
      <div>
        <dt>{t("method")}</dt>
        <dd>{config.mcdm ?? "wsm"}</dd>
      </div>
      <div>
        <dt>{t("missingThreshold")}</dt>
        <dd>{config.missingThreshold ?? 0.2}</dd>
      </div>
    </dl>
  );
}
