import { countryLabel } from "../design/formatLocale";
import { hsLabel } from "../data/hsProducts";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { PermalinkLink } from "../components/PermalinkLink";

function shopSearchUrl(
  kind: "google" | "amazon",
  product: string,
  marketIso: string,
): string {
  const q = encodeURIComponent(`${product} ${marketIso}`);
  if (kind === "amazon") {
    return `https://www.amazon.com/s?k=${q}`;
  }
  return `https://www.google.com/search?q=${q}+price`;
}

/**
 * Step 5 — Product / Price / Place / Promotion sketch from available project data.
 * Shop prices are paste-only (never scraped or invented).
 */
export function Plan4P() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();

  const product =
    config.hs && lang === "es"
      ? hsLabel(config.hs, "es")
      : config.hs
        ? hsLabel(config.hs, "en")
        : t("chipChoose");
  const market = config.targetMarket
    ? countryLabel(config.targetMarket, lang)
    : t("chipChoose");
  const origin = config.origin ? countryLabel(config.origin, lang) : t("chipChoose");

  const googleUrl =
    config.hs && config.targetMarket ? shopSearchUrl("google", product, market) : null;
  const amazonUrl =
    config.hs && config.targetMarket ? shopSearchUrl("amazon", product, market) : null;

  return (
    <section className="wrap page-plan4p" data-testid="plan-4p">
      <header className="page-head">
        <h1>{t("stepPlan4p")}</h1>
        <p className="muted lead">{t("plan4pLead")}</p>
      </header>

      {!config.targetMarket ? (
        <p className="muted" role="status">
          {t("plan4pNeedTarget")}{" "}
          <PermalinkLink view="mercado_objetivo">{t("stepMercado")}</PermalinkLink>
        </p>
      ) : null}

      <div className="plan4p-grid" data-testid="plan4p-grid">
        <article className="plan4p-card">
          <h2>{t("plan4pProduct")}</h2>
          <p>
            {t("chipProduct")}: <b>{product}</b>
            {config.hs ? ` (HS ${config.hs})` : ""}
          </p>
          <p>
            {t("chipOrigin")}: <b>{origin}</b>
          </p>
        </article>

        <article className="plan4p-card">
          <h2>{t("plan4pPrice")}</h2>
          <p className="muted small">{t("plan4pPriceHint")}</p>
          {googleUrl ? (
            <p>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                {t("plan4pGoogle")}
              </a>
              {" · "}
              <a href={amazonUrl!} target="_blank" rel="noopener noreferrer">
                {t("plan4pAmazon")}
              </a>
            </p>
          ) : null}
          <label className="field block">
            <span>{t("plan4pPastePrices")}</span>
            <textarea
              data-testid="plan4p-prices"
              rows={6}
              maxLength={8000}
              value={config.pastedShopPrices ?? ""}
              onChange={(e) =>
                setConfig({
                  pastedShopPrices: e.target.value.slice(0, 8000) || undefined,
                  view: "plan_4p",
                })
              }
              placeholder={t("plan4pPastePlaceholder")}
            />
          </label>
        </article>

        <article className="plan4p-card">
          <h2>{t("plan4pPlace")}</h2>
          <p>
            {t("mercadoTarget")}: <b>{market}</b>
          </p>
          <p>
            {t("mercadoReserves")}:{" "}
            <b>
              {(config.reserveMarkets ?? [])
                .map((iso) => countryLabel(iso, lang))
                .join(", ") || t("mercadoNoReserves")}
            </b>
          </p>
        </article>

        <article className="plan4p-card">
          <h2>{t("plan4pPromo")}</h2>
          <p className="muted">{t("plan4pPromoHint")}</p>
          {config.whyTargetMarket ? (
            <blockquote data-testid="plan4p-why">{config.whyTargetMarket}</blockquote>
          ) : (
            <p className="muted small">{t("plan4pNoWhy")}</p>
          )}
        </article>
      </div>

      <footer className="page-nav-row">
        <PermalinkLink view="mercado_objetivo" className="btn">
          {t("stepMercado")}
        </PermalinkLink>
        <PermalinkLink view="preparar_envio" className="btn btn-primary">
          {t("stepEnvio")}
        </PermalinkLink>
      </footer>
    </section>
  );
}
