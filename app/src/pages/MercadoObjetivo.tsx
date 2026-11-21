import { useMemo } from "react";
import { countryLabel } from "../design/formatLocale";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";
import { isAnalysisReady } from "../state/views";
import { PermalinkLink } from "../components/PermalinkLink";

/**
 * Step 4 — choose target market + up to 3 reserves from the ranking.
 * No invented scores: only what the current analysis already computed.
 */
export function MercadoObjetivo() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const { model, loading } = useRankingModel();
  const ready = isAnalysisReady(config);

  const ranked = useMemo(() => {
    if (!model?.ranking?.length) return [];
    return model.ranking.map((r) => ({
      iso3: r.iso3,
      score: r.score,
      rank: r.rank,
    }));
  }, [model]);

  const reserves = config.reserveMarkets ?? [];

  function pickTarget(iso3: string) {
    const nextReserves = reserves.filter((x) => x !== iso3).slice(0, 3);
    setConfig({
      targetMarket: iso3,
      reserveMarkets: nextReserves.length ? nextReserves : undefined,
      view: "mercado_objetivo",
    });
  }

  function toggleReserve(iso3: string) {
    if (iso3 === config.targetMarket) return;
    let next: string[];
    if (reserves.includes(iso3)) {
      next = reserves.filter((x) => x !== iso3);
    } else if (reserves.length >= 3) {
      next = [...reserves.slice(1), iso3];
    } else {
      next = [...reserves, iso3];
    }
    setConfig({
      reserveMarkets: next.length ? next : undefined,
      view: "mercado_objetivo",
    });
  }

  if (!ready) {
    return (
      <section className="wrap page-mercado" data-testid="mercado-objetivo">
        <h1>{t("stepMercado")}</h1>
        <p className="muted">{t("stepNeedScope")}</p>
        <PermalinkLink view="datos" className="btn btn-primary">
          {t("stepDatos")}
        </PermalinkLink>
      </section>
    );
  }

  return (
    <section className="wrap page-mercado" data-testid="mercado-objetivo">
      <header className="page-head">
        <h1>{t("stepMercado")}</h1>
        <p className="muted lead">{t("mercadoLead")}</p>
      </header>

      {loading ? <p className="muted">{t("loading")}</p> : null}

      <div className="mercado-picks" data-testid="mercado-picks">
        <p>
          {t("mercadoTarget")}:{" "}
          <b data-testid="mercado-target-label">
            {config.targetMarket
              ? countryLabel(config.targetMarket, lang)
              : t("chipChoose")}
          </b>
        </p>
        <p>
          {t("mercadoReserves")}:{" "}
          <b data-testid="mercado-reserves-label">
            {reserves.length
              ? reserves.map((iso) => countryLabel(iso, lang)).join(", ")
              : t("mercadoNoReserves")}
          </b>
        </p>
      </div>

      <label className="field block">
        <span>{t("mercadoWhy")}</span>
        <textarea
          data-testid="mercado-why"
          rows={4}
          maxLength={2000}
          value={config.whyTargetMarket ?? ""}
          onChange={(e) =>
            setConfig({
              whyTargetMarket: e.target.value.slice(0, 2000) || undefined,
              view: "mercado_objetivo",
            })
          }
          placeholder={t("mercadoWhyPlaceholder")}
        />
      </label>

      <div className="table-scroll">
        <table className="data-table" data-testid="mercado-ranking-table">
          <thead>
            <tr>
              <th>{t("mercadoColRank")}</th>
              <th>{t("mercadoColCountry")}</th>
              <th>{t("mercadoColScore")}</th>
              <th>{t("mercadoColActions")}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.slice(0, 40).map((row) => {
              const isTarget = row.iso3 === config.targetMarket;
              const isReserve = reserves.includes(row.iso3);
              return (
                <tr
                  key={row.iso3}
                  className={
                    isTarget ? "row-target" : isReserve ? "row-reserve" : undefined
                  }
                >
                  <td>{row.rank}</td>
                  <td>{countryLabel(row.iso3, lang)}</td>
                  <td>{Number.isFinite(row.score) ? row.score.toFixed(3) : "—"}</td>
                  <td className="mercado-actions">
                    <button
                      type="button"
                      className={`btn${isTarget ? " btn-primary" : ""}`}
                      data-testid={`mercado-target-${row.iso3}`}
                      onClick={() => pickTarget(row.iso3)}
                    >
                      {isTarget ? t("mercadoIsTarget") : t("mercadoSetTarget")}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={isTarget}
                      data-testid={`mercado-reserve-${row.iso3}`}
                      onClick={() => toggleReserve(row.iso3)}
                    >
                      {isReserve ? t("mercadoUnsetReserve") : t("mercadoSetReserve")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!ranked.length && !loading ? (
        <p className="muted" role="status">
          {t("mercadoNoRanking")}
        </p>
      ) : null}

      <footer className="page-nav-row">
        <PermalinkLink view="analisis" className="btn">
          {t("stepResultados")}
        </PermalinkLink>
        {config.targetMarket ? (
          <PermalinkLink view="plan_4p" className="btn btn-primary">
            {t("stepPlan4p")}
          </PermalinkLink>
        ) : (
          <span className="btn btn-primary" aria-disabled="true">
            {t("stepPlan4p")}
          </span>
        )}
      </footer>
    </section>
  );
}
