import { useMemo } from "react";
import { useTranslation } from "../i18n";
import { CRITERION_LABEL, isCriterionId } from "../design/criteria";
import { formatScoreLocale } from "../design/formatLocale";
import type { RankingViewModel } from "../ranking/rankingEngine";

type Props = {
  model: RankingViewModel;
  selected: string[];
  onToggle: (iso3: string) => void;
};

function factorLabel(id: string, lang: "es" | "en"): string {
  if (isCriterionId(id)) return CRITERION_LABEL[id][lang];
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Side-by-side factor table for 2–4 markets (read-only compare). */
export function MarketRadarCompare({ model, selected, onToggle }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const factors = useMemo(() => Object.keys(model.weights.factors).sort(), [model]);
  const picks = selected.slice(0, 4);

  return (
    <div className="market-radar-compare" data-testid="market-radar-compare">
      <p className="lead-tight">{t("compareMarketsIntro")}</p>
      <div className="compare-picks" role="group" aria-label={t("nav.compare")}>
        {model.ranking.slice(0, 12).map((r) => {
          const on = picks.includes(r.iso3);
          return (
            <button
              key={r.iso3}
              type="button"
              className={`btn compare-pick ${on ? "btn-primary" : "btn-secondary"}`}
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
        <div className="table-scroll compare-radar-scroll">
          <table className="compare-radar-table" data-testid="compare-radar-table">
            <thead>
              <tr>
                <th scope="col">{t("variables")}</th>
                {picks.map((iso) => (
                  <th key={iso} scope="col">
                    {iso}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f}>
                  <th scope="row">{factorLabel(f, lang)}</th>
                  {picks.map((iso) => {
                    const v = model.factorScores[iso]?.[f] ?? 0;
                    const pct = Math.max(4, Math.min(100, (v / 10) * 100));
                    return (
                      <td key={iso}>
                        <div className="compare-metric">
                          <span className="font-tabular compare-metric-val">
                            {formatScoreLocale(v, lang)}
                          </span>
                          <span
                            className="compare-bar-track"
                            aria-hidden
                            title={formatScoreLocale(v, lang)}
                          >
                            <span
                              className="compare-bar"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="compare-radar-total">
                <th scope="row">IMSFE</th>
                {picks.map((iso) => {
                  const row = model.ranking.find((r) => r.iso3 === iso);
                  return (
                    <td key={iso} className="font-tabular">
                      <span className="compare-rank">#{row?.rank}</span>
                      <span className="compare-score">
                        {formatScoreLocale(row?.score ?? 0, lang)}
                      </span>
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
