import { useMemo } from "react";
import { useTranslation } from "../i18n";
import { formatPctLocale } from "../design/formatLocale";
import { useRankingModel } from "../ranking/useRankingModelApi";

const FACTOR_TINTS = [
  "#0072B2",
  "#E69F00",
  "#009E73",
  "#CC79A7",
  "#56B4E9",
  "#D55E00",
  "#0F766E",
];

/**
 * ValueCharts-style nested bars: factor weight width, then within-factor
 * variable shares (Carenini & Loyd, AVI 2004). Variables / Pesos only.
 */
export function ValueChartsPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { model } = useRankingModel();

  const rows = useMemo(() => {
    if (!model) return [];
    const factors = Object.entries(model.weights.factors).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    return factors.map(([factor, w]) => {
      const within = model.weights.variablesWithin[factor] ?? {};
      const kids = Object.entries(within).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      return { factor, w, kids };
    });
  }, [model]);

  if (!model || rows.length === 0) {
    return (
      <p className="muted small" data-testid="valuecharts-pending">
        {t("valueChartsPending")}
      </p>
    );
  }

  return (
    <fieldset className="valuecharts" data-testid="valuecharts-panel">
      <legend>{t("valueChartsTitle")}</legend>
      <p className="muted small">{t("valueChartsIntro")}</p>
      <ul className="valuecharts-list">
        {rows.map(({ factor, w, kids }, i) => (
          <li key={factor} data-testid={`valuecharts-${factor}`}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>{factor}</span>
              <span className="font-tabular text-ink-2">
                {formatPctLocale(w, lang)}
              </span>
            </div>
            <div
              className="valuecharts-bar"
              style={{
                width: `${Math.max(4, w * 100)}%`,
                background: FACTOR_TINTS[i % FACTOR_TINTS.length],
              }}
              title={`${factor} ${formatPctLocale(w, lang)}`}
            />
            {kids.length > 0 ? (
              <ul className="valuecharts-children">
                {kids.map(([vid, vw]) => (
                  <li key={vid} className="flex items-center gap-2 text-xs">
                    <span
                      className="valuecharts-child-bar"
                      style={{ width: `${Math.max(2, vw * 48)}px` }}
                    />
                    <code>{vid}</code>
                    <span className="font-tabular text-ink-3">
                      {formatPctLocale(vw, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
