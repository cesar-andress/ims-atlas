import { useMemo } from "react";
import { useTranslation } from "../i18n";
import { formatPctLocale } from "../design/formatLocale";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";

/** Permanent summary of the current analysis selection (Variables hub). */
export function VariablesSummaryBar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config } = useAnalysis();
  const { model, loading } = useRankingModel();

  const line = useMemo(() => {
    const nVar =
      model?.prepared.usedVariables.length ?? config.variableIds?.length ?? 0;
    const nCrit = model ? Object.keys(model.weights.factors).length : 0;
    const nMarkets = model?.prepared.candidates.length ?? 0;
    const warnings =
      (model?.warnings.length ?? 0) + (model?.prepared.notes.length ?? 0);
    // Cell-level completeness after median imputation (imputed cells count as present).
    const cells =
      model !== null
        ? model.prepared.nCandidates * model.prepared.usedVariables.length
        : 0;
    const covLabel =
      cells > 0
        ? formatPctLocale(1 - model!.prepared.nImputedCells / cells, lang, 0)
        : "—";
    return t("variablesSummaryLine")
      .replace("{vars}", String(nVar || "—"))
      .replace("{crit}", String(nCrit || "—"))
      .replace("{markets}", String(nMarkets || "—"))
      .replace("{coverage}", covLabel)
      .replace("{warnings}", String(warnings));
  }, [config.variableIds, model, lang, t]);

  return (
    <div
      className="variables-summary-bar"
      data-testid="variables-summary-bar"
      role="status"
    >
      <p className="m-0 font-tabular text-sm">
        {loading && !model ? t("loading") : line}
      </p>
      <p className="muted small m-0">
        {[
          config.origin ?? "—",
          config.hs ? `HS ${config.hs}` : "—",
          config.year ?? "—",
        ].join(" · ")}
      </p>
    </div>
  );
}
