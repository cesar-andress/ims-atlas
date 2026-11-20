import { useMemo } from "react";
import { useTranslation } from "../i18n";
import { formatScoreLocale } from "../design/formatLocale";
import type { RankingViewModel } from "../ranking/rankingEngine";

type Props = {
  model: RankingViewModel;
  selected: string[];
  onToggle: (iso3: string) => void;
};

/** Side-by-side radar-ish table for 2–4 markets (read-only compare). */
export function MarketRadarCompare({ model, selected, onToggle }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const factors = useMemo(() => Object.keys(model.weights.factors).sort(), [model]);
  const picks = selected.slice(0, 4);

  return (
    <div className="market-radar-compare" data-testid="market-radar-compare">
      <p className="muted small">{t("compareMarketsIntro")}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {model.ranking.slice(0, 12).map((r) => {
          const on = picks.includes(r.iso3);
          return (
            <button
              key={r.iso3}
              type="button"
              className={`btn ${on ? "btn-primary" : "btn-secondary"}`}
              data-testid={`compare-pick-${r.iso3}`}
              aria-pressed={on}
              onClick={() => onToggle(r.iso3)}
              disabled={!on && picks.length >= 4}
            >
              {r.iso3}
            </button>
          );
        })}
      </div>
      {picks.length < 2 ? (
        <p className="muted" data-testid="compare-need-two">
          {t("compareNeedTwo")}
        </p>
      ) : (
        <div className="table-scroll">
          <table data-testid="compare-radar-table">
            <thead>
              <tr>
                <th>{t("variables")}</th>
                {picks.map((iso) => (
                  <th key={iso}>{iso}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f}>
                  <td>{f}</td>
                  {picks.map((iso) => {
                    const v = model.factorScores[iso]?.[f] ?? 0;
                    return (
                      <td key={iso}>
                        <div
                          className="compare-bar"
                          style={{ width: `${Math.max(4, (v / 10) * 100)}%` }}
                          title={formatScoreLocale(v, lang)}
                        />
                        <span className="font-tabular text-xs">
                          {formatScoreLocale(v, lang)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td>
                  <strong>IMSFE</strong>
                </td>
                {picks.map((iso) => {
                  const row = model.ranking.find((r) => r.iso3 === iso);
                  return (
                    <td key={iso} className="font-tabular">
                      #{row?.rank} · {formatScoreLocale(row?.score ?? 0, lang)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
