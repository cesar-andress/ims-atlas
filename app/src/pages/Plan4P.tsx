import { useEffect, useMemo, useState } from "react";
import { version as APP_VERSION } from "@ims-atlas/core";
import { PermalinkLink } from "../components/PermalinkLink";
import { countryLabel } from "../design/formatLocale";
import {
  loadBaciTopExportersToMarket,
  type BaciExportersToMarketResult,
} from "../data/baciTopExportersToMarket";
import { intraEuDutyRate } from "../data/euTradeContext";
import { hs2Of, hsLabel } from "../data/hsProducts";
import { panelValueAt } from "../data/panelValueAt";
import { vatRateForIso3 } from "../data/vatRatesResearch";
import { dataConfig } from "../dataConfig";
import { buildXlsx, readmeSheet, rowsToCsv } from "../export/xlsx";
import { useTranslation } from "../i18n";
import { useRankingModel } from "../ranking/useRankingModelApi";
import { useAnalysis } from "../state/useAnalysis";
import { downloadBlob } from "../state/projectExport";

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

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)} %`;
}

/**
 * Step 5 — Product / Price / Place / Promotion from project + ranking panel + BACI.
 * Shop prices remain paste-only.
 */
export function Plan4P() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const { model, loading } = useRankingModel();

  const productEs = config.hs ? hsLabel(config.hs, "es") : t("chipChoose");
  const productEn = config.hs ? hsLabel(config.hs, "en") : t("chipChoose");
  const product = lang === "es" ? productEs : productEn;
  const market = config.targetMarket
    ? countryLabel(config.targetMarket, lang)
    : t("chipChoose");
  const origin = config.origin ? countryLabel(config.origin, lang) : t("chipChoose");

  const top3 = useMemo(() => {
    if (!model?.ranking?.length) return [];
    return model.ranking.slice(0, 3);
  }, [model]);

  const [exporters, setExporters] = useState<BaciExportersToMarketResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!config.hs || !config.year || !config.targetMarket) {
      setExporters(null);
      return;
    }
    // Trade release is HS2-only; collapse HS4/HS6 to chapter for BACI suppliers.
    const hs2 = hs2Of(config.hs).padStart(2, "0");
    void loadBaciTopExportersToMarket({
      hs: hs2,
      year: config.year,
      importer: config.targetMarket,
      topN: 5,
    }).then((r) => {
      if (!cancelled) setExporters(r);
    });
    return () => {
      cancelled = true;
    };
  }, [config.hs, config.year, config.targetMarket]);

  const dist = panelValueAt(model?.panel, config.targetMarket, "DIST");
  const langVar = panelValueAt(model?.panel, config.targetMarket, "LANG");
  const fta = panelValueAt(model?.panel, config.targetMarket, "FTA");
  const pli = panelValueAt(model?.panel, config.targetMarket, "PLI");
  const cult = panelValueAt(model?.panel, config.targetMarket, "CULT");
  const lpi =
    panelValueAt(model?.panel, config.targetMarket, "LPI") ??
    panelValueAt(model?.panel, config.targetMarket, "LPIN");

  const duty = useMemo(
    () => intraEuDutyRate(config.origin, config.targetMarket),
    [config.origin, config.targetMarket],
  );
  const vat = useMemo(() => vatRateForIso3(config.targetMarket), [config.targetMarket]);

  const marketShare = useMemo(() => {
    if (!exporters || exporters.source !== "baci_release" || !config.origin) {
      return null;
    }
    const row = exporters.rows.find((r) => r.iso3 === config.origin);
    if (row) return row;
    // Origin may be outside top-N; share unknown without full scan.
    return null;
  }, [exporters, config.origin]);

  const googleUrl =
    config.hs && config.targetMarket ? shopSearchUrl("google", product, market) : null;
  const amazonUrl =
    config.hs && config.targetMarket ? shopSearchUrl("amazon", product, market) : null;

  function pickTarget(iso3: string) {
    setConfig({
      targetMarket: iso3,
      reserveMarkets: (config.reserveMarkets ?? [])
        .filter((x) => x !== iso3)
        .slice(0, 3),
      view: "plan_4p",
    });
  }

  function downloadFicha() {
    const rows: string[][] = [
      ["bloque", "dato", "valor", "fuente"],
      ["producto", "nombre_es", productEs, "HS nomenclature"],
      ["producto", "hs", config.hs ?? "", "project"],
      ["producto", "origen", origin, "project"],
      [
        "producto",
        "competidores",
        exporters?.rows.map((r) => r.iso3).join(", ") ?? "",
        exporters?.source === "baci_release" ? "BACI" : "",
      ],
      ["precio", "pli", pli ? String(pli.value) : "", pli?.sourceHint ?? ""],
      ["precio", "arancel", duty ? String(duty.rate) : "", duty?.sourceNote ?? ""],
      ["precio", "iva", vat ? String(vat.rate) : "", vat?.sourceNote ?? ""],
      [
        "precio",
        "uv_baci",
        "",
        "unavailable: trade release has value_usd only (no quantity)",
      ],
      ["precio", "precios_pegados", config.pastedShopPrices ?? "", "user paste"],
      ["lugar", "mercado", market, "project"],
      ["lugar", "dist_km", dist ? String(dist.value) : "", dist?.sourceHint ?? ""],
      ["lugar", "fta", fta ? String(fta.value) : "", fta?.sourceHint ?? ""],
      ["lugar", "lpi", lpi ? String(lpi.value) : "", lpi?.sourceHint ?? ""],
      [
        "promo",
        "idioma_comun",
        langVar ? String(langVar.value) : "",
        langVar?.sourceHint ?? "",
      ],
      [
        "promo",
        "distancia_cultural",
        cult ? String(cult.value) : "",
        cult?.sourceHint ?? "",
      ],
      ["promo", "motivo", config.whyTargetMarket ?? "", "user"],
    ];
    const blob = buildXlsx([
      readmeSheet({
        title: `Plan 4P — ${productEs} · ${market}`,
        appVersion: APP_VERSION,
        releaseId: dataConfig.release_version,
        exportDate: new Date().toISOString().slice(0, 10),
      }),
      { name: "plan4p", rows },
    ]);
    downloadBlob(blob, "ims-atlas-plan4p.xlsx");
    downloadBlob(
      new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" }),
      "ims-atlas-plan4p.csv",
    );
  }

  return (
    <section className="wrap page-plan4p" data-testid="plan-4p">
      <header className="page-head">
        <h1>{t("stepPlan4p")}</h1>
        <p className="muted lead">{t("plan4pLead")}</p>
        <p className="envio-project-chip" data-testid="plan4p-project-context">
          <span>
            {t("chipProduct")} <b>{product}</b>
          </span>
          <span>
            {t("chipOrigin")} <b>{origin}</b>
          </span>
          <span>
            {t("mercadoTarget")} <b>{market}</b>
          </span>
          {config.year != null ? (
            <span>
              {t("chipYear")} <b>{config.year}</b>
            </span>
          ) : null}
        </p>
        <div className="envio-preset-row">
          <button
            type="button"
            className="btn"
            data-testid="plan4p-download"
            onClick={downloadFicha}
          >
            {t("plan4pDownload")}
          </button>
        </div>
      </header>

      {!config.targetMarket ? (
        <div className="plan4p-pick" data-testid="plan4p-pick-top">
          <p className="muted">{t("plan4pNeedTarget")}</p>
          {loading ? <p className="muted">{t("loading")}</p> : null}
          {top3.length ? (
            <div className="plan4p-top3">
              {top3.map((r) => (
                <button
                  key={r.iso3}
                  type="button"
                  className="plan4p-top3-card"
                  data-testid={`plan4p-pick-${r.iso3}`}
                  onClick={() => pickTarget(r.iso3)}
                >
                  <span className="plan4p-top3-rank">#{r.rank}</span>
                  <strong>{countryLabel(r.iso3, lang)}</strong>
                  <span className="muted small">
                    {Number.isFinite(r.score) ? r.score.toFixed(3) : "—"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted" role="status">
              {t("plan4pNoRanking")}{" "}
              <PermalinkLink view="mercado_objetivo">{t("stepMercado")}</PermalinkLink>
            </p>
          )}
        </div>
      ) : null}

      <div className="plan4p-grid" data-testid="plan4p-grid">
        <article className="plan4p-card" data-testid="plan4p-card-product">
          <h2>{t("plan4pProduct")}</h2>
          <p className="plan4p-metric">
            <span className="plan4p-metric-label">{t("chipProduct")}</span>
            <strong>{product}</strong>
          </p>
          {config.hs ? (
            <p className="muted small" data-testid="plan4p-hs-detail">
              HS {config.hs}
            </p>
          ) : null}
          <p className="plan4p-metric">
            <span className="plan4p-metric-label">{t("chipOrigin")}</span>
            <strong>{origin}</strong>
          </p>
          {exporters?.source === "baci_release" && exporters.rows.length ? (
            <>
              <p className="plan4p-metric">
                <span className="plan4p-metric-label">{t("plan4pCompetitors")}</span>
              </p>
              <ul className="plan4p-list" data-testid="plan4p-competitors">
                {exporters.rows.map((r) => (
                  <li key={r.iso3}>
                    {countryLabel(r.iso3, lang)} · {fmtPct(r.share)} ·{" "}
                    {fmtUsd(r.valueUsd)}
                  </li>
                ))}
              </ul>
              <p className="field-source">
                BACI · HS{exporters.hs2} · {exporters.year} · {exporters.importer}
              </p>
              {marketShare ? (
                <p data-testid="plan4p-origin-share">
                  {t("plan4pOriginShare")
                    .replace("{origin}", origin)
                    .replace("{pct}", fmtPct(marketShare.share))}
                </p>
              ) : (
                <p className="muted small">{t("plan4pOriginShareMissing")}</p>
              )}
            </>
          ) : (
            <p className="muted small" data-testid="plan4p-competitors-empty">
              {t("plan4pCompetitorsEmpty")}
            </p>
          )}
        </article>

        <article className="plan4p-card" data-testid="plan4p-card-price">
          <h2>{t("plan4pPrice")}</h2>
          {pli ? (
            <p className="plan4p-metric" data-testid="plan4p-pli">
              <span className="plan4p-metric-label">{t("plan4pPli")}</span>
              <strong>{pli.value.toFixed(1)}</strong>
              <span className="field-source">{pli.sourceHint}</span>
            </p>
          ) : (
            <p className="muted small">{t("plan4pPliMissing")}</p>
          )}
          {duty ? (
            <p className="plan4p-metric" data-testid="plan4p-duty">
              <span className="plan4p-metric-label">{t("plan4pDuty")}</span>
              <strong>{fmtPct(duty.rate)}</strong>
              <span className="field-source">{duty.sourceNote}</span>
            </p>
          ) : (
            <p className="muted small" data-testid="plan4p-duty-missing">
              {t("plan4pDutyMissing")}
            </p>
          )}
          {vat ? (
            <p className="plan4p-metric" data-testid="plan4p-vat">
              <span className="plan4p-metric-label">{t("plan4pVat")}</span>
              <strong>{fmtPct(vat.rate)}</strong>
              <span className="field-source">
                {vat.sourceNote} ({vat.year})
              </span>
            </p>
          ) : (
            <p className="muted small" data-testid="plan4p-vat-missing">
              {t("plan4pVatMissing")}
            </p>
          )}
          <p className="muted small" data-testid="plan4p-uv-missing">
            {t("plan4pUnitValueMissing")}
          </p>
          <p className="muted small">{t("plan4pPriceHint")}</p>
          {googleUrl ? (
            <p>
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="plan4p-google"
              >
                {t("plan4pGoogleCountry").replace("{country}", market)}
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

        <article className="plan4p-card" data-testid="plan4p-card-place">
          <h2>{t("plan4pPlace")}</h2>
          <p className="plan4p-metric">
            <span className="plan4p-metric-label">{t("mercadoTarget")}</span>
            <strong>{market}</strong>
          </p>
          {dist ? (
            <p className="plan4p-metric" data-testid="plan4p-dist">
              <span className="plan4p-metric-label">{t("plan4pDist")}</span>
              <strong>{Math.round(dist.value).toLocaleString("es-ES")} km</strong>
              <span className="field-source">{dist.sourceHint}</span>
            </p>
          ) : (
            <p className="muted small">{t("plan4pDistMissing")}</p>
          )}
          {lpi ? (
            <p className="plan4p-metric" data-testid="plan4p-lpi">
              <span className="plan4p-metric-label">{t("plan4pLpi")}</span>
              <strong>{lpi.value.toFixed(2)}</strong>
              <span className="field-source">{lpi.sourceHint}</span>
            </p>
          ) : (
            <p className="muted small">{t("plan4pLpiMissing")}</p>
          )}
          {fta ? (
            <p className="plan4p-metric" data-testid="plan4p-fta">
              <span className="plan4p-metric-label">{t("plan4pFta")}</span>
              <strong>{fta.value >= 0.5 ? t("plan4pYes") : t("plan4pNo")}</strong>
              <span className="field-source">{fta.sourceHint}</span>
            </p>
          ) : (
            <p className="muted small">{t("plan4pFtaMissing")}</p>
          )}
          <p>
            {t("mercadoReserves")}:{" "}
            <b>
              {(config.reserveMarkets ?? [])
                .map((iso) => countryLabel(iso, lang))
                .join(", ") || t("mercadoNoReserves")}
            </b>
          </p>
        </article>

        <article className="plan4p-card" data-testid="plan4p-card-promo">
          <h2>{t("plan4pPromo")}</h2>
          {langVar ? (
            <p className="plan4p-metric" data-testid="plan4p-lang">
              <span className="plan4p-metric-label">{t("plan4pLang")}</span>
              <strong>
                {langVar.value >= 0.5 ? t("plan4pLangYes") : t("plan4pLangNo")}
              </strong>
              <span className="field-source">{langVar.sourceHint}</span>
            </p>
          ) : (
            <p className="muted small">{t("plan4pLangMissing")}</p>
          )}
          {cult ? (
            <p className="plan4p-metric" data-testid="plan4p-cult">
              <span className="plan4p-metric-label">{t("plan4pCult")}</span>
              <strong>{cult.value.toFixed(2)}</strong>
              <span className="field-source">{cult.sourceHint}</span>
            </p>
          ) : (
            <p className="muted small" data-testid="plan4p-cult-missing">
              {t("plan4pCultMissing")}
            </p>
          )}
          <p className="muted small">{t("plan4pFairsMissing")}</p>
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
