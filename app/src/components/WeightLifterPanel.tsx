import { useMemo } from "react";
import { oneAtATimeWinnerThresholds } from "@ims-atlas/core";
import { useTranslation } from "../i18n";
import { formatPctLocale } from "../design/formatLocale";
import { useRankingModel } from "../ranking/useRankingModelApi";

/** WeightLifter-style stability intervals (Variables only). */
export function WeightLifterPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { model } = useRankingModel();

  const rows = useMemo(() => {
    if (!model) return [];
    try {
      return oneAtATimeWinnerThresholds({
        normalized: model.normalized,
        columns: model.prepared.usedVariables,
        candidates: model.prepared.candidates,
        weights: model.weights,
        steps: 51,
      });
    } catch {
      // Never blank the Variables page: OAT is diagnostic-only.
      return [];
    }
  }, [model]);

  if (!model || rows.length === 0) {
    return (
      <p className="muted small" data-testid="weightlifter-pending">
        {t("weightLifterPending")}
      </p>
    );
  }

  const winner = rows[0]?.baselineWinner ?? "-";

  return (
    <fieldset className="weightlifter" data-testid="weightlifter-panel">
      <legend>{t("weightLifterTitle")}</legend>
      <p className="muted small">{t("weightLifterIntro")}</p>
      <p className="small" data-testid="weightlifter-winner">
        {t("weightLifterWinner")}: <strong>{winner}</strong>
      </p>
      <ul className="compact">
        {rows.map((r) => {
          const lo =
            r.lowerBeforeChange === null
              ? "-"
              : formatPctLocale(r.lowerBeforeChange, lang);
          const hi =
            r.upperBeforeChange === null
              ? "-"
              : formatPctLocale(r.upperBeforeChange, lang);
          return (
            <li key={r.factor} data-testid={`weightlifter-${r.factor}`}>
              <strong>{r.factor}</strong> {formatPctLocale(r.baselineWeight, lang)} · [
              {lo} … {hi}]{r.challengerAtLower ? ` · ↓ ${r.challengerAtLower}` : ""}
              {r.challengerAtUpper ? ` · ↑ ${r.challengerAtUpper}` : ""}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
