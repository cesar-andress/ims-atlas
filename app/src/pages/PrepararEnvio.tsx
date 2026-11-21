import { useMemo, useState } from "react";
import {
  JOSE_DEFAULT_INPUT,
  liquidateIncoterms,
  type IncotermMode,
} from "@ims-atlas/core";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { PermalinkLink } from "../components/PermalinkLink";

type TabId = "contenedor" | "incoterms" | "documentos";

const CONTAINER_PRESETS = [
  {
    id: "20",
    labelKey: "envioCont20" as const,
    lengthM: 5.9,
    widthM: 2.35,
    heightM: 2.39,
  },
  {
    id: "40",
    labelKey: "envioCont40" as const,
    lengthM: 12.03,
    widthM: 2.35,
    heightM: 2.39,
  },
  {
    id: "40hc",
    labelKey: "envioCont40hc" as const,
    lengthM: 12.03,
    widthM: 2.35,
    heightM: 2.69,
  },
];

/**
 * Step 6 — Contenedor (basic), Incoterms (Jose case), Documentos (Próximamente).
 */
export function PrepararEnvio() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const [tab, setTab] = useState<TabId>("incoterms");
  const [contType, setContType] = useState("40");
  const [palletL, setPalletL] = useState(1.2);
  const [palletW, setPalletW] = useState(0.8);
  const [layers, setLayers] = useState(2);

  const mode: IncotermMode = config.incotermsMode ?? "excel";
  const selected = config.selectedIncoterm ?? "DDP";

  const rows = useMemo(
    () =>
      liquidateIncoterms({
        ...JOSE_DEFAULT_INPUT,
        mode,
        dutyBase: mode === "corrected" ? "fob" : "cif",
        vatRate: 0,
      }),
    [mode],
  );

  const cont =
    CONTAINER_PRESETS.find((c) => c.id === contType) ?? CONTAINER_PRESETS[1]!;
  const along = Math.max(1, Math.floor(cont.lengthM / palletL));
  const across = Math.max(1, Math.floor(cont.widthM / palletW));
  const floorPallets = along * across;
  const totalPallets = floorPallets * Math.max(1, layers);

  const fmtEur = (n: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <section className="wrap page-envio" data-testid="preparar-envio">
      <header className="page-head">
        <h1>{t("stepEnvio")}</h1>
        <p className="muted lead">{t("envioLead")}</p>
      </header>

      <div
        className="tabs"
        role="tablist"
        aria-label={t("envioTabs")}
        data-testid="envio-tabs"
      >
        {(
          [
            ["contenedor", t("envioTabContenedor")],
            ["incoterms", t("envioTabIncoterms")],
            ["documentos", t("envioTabDocumentos")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tab${tab === id ? " active" : ""}`}
            data-testid={`envio-tab-${id}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "contenedor" ? (
        <div className="envio-panel" data-testid="envio-contenedor">
          <p className="muted">{t("envioContLead")}</p>
          <label className="field">
            <span>{t("envioContType")}</span>
            <select
              value={contType}
              onChange={(e) => setContType(e.target.value)}
              data-testid="envio-cont-type"
            >
              {CONTAINER_PRESETS.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <div className="envio-cont-grid">
            <label className="field">
              <span>{t("envioPalletL")}</span>
              <input
                type="number"
                min={0.4}
                step={0.01}
                value={palletL}
                onChange={(e) => setPalletL(Number(e.target.value) || 1.2)}
              />
            </label>
            <label className="field">
              <span>{t("envioPalletW")}</span>
              <input
                type="number"
                min={0.4}
                step={0.01}
                value={palletW}
                onChange={(e) => setPalletW(Number(e.target.value) || 0.8)}
              />
            </label>
            <label className="field">
              <span>{t("envioLayers")}</span>
              <input
                type="number"
                min={1}
                max={8}
                value={layers}
                onChange={(e) => setLayers(Math.trunc(Number(e.target.value)) || 1)}
              />
            </label>
          </div>
          <p data-testid="envio-cont-result">
            {t("envioContResult")
              .replace("{floor}", String(floorPallets))
              .replace("{total}", String(totalPallets))
              .replace("{along}", String(along))
              .replace("{across}", String(across))}
          </p>
          <p className="muted small">{t("envioContSoon")}</p>
        </div>
      ) : null}

      {tab === "incoterms" ? (
        <div className="envio-panel" data-testid="envio-incoterms">
          <p className="muted">{t("envioIncoLead")}</p>
          <div className="envio-mode" role="group" aria-label={t("envioIncoMode")}>
            <button
              type="button"
              className={`btn${mode === "excel" ? " btn-primary" : ""}`}
              data-testid="envio-mode-excel"
              onClick={() =>
                setConfig({ incotermsMode: "excel", view: "preparar_envio" })
              }
            >
              {t("envioModeExcel")}
            </button>
            <button
              type="button"
              className={`btn${mode === "corrected" ? " btn-primary" : ""}`}
              data-testid="envio-mode-corrected"
              onClick={() =>
                setConfig({ incotermsMode: "corrected", view: "preparar_envio" })
              }
            >
              {t("envioModeCorrected")}
            </button>
          </div>
          {mode === "excel" ? (
            <p className="pill ok" data-testid="envio-jose-badge">
              {t("envioJoseBadge")}
            </p>
          ) : (
            <p className="pill" data-testid="envio-corrected-badge">
              {t("envioCorrectedBadge")}
            </p>
          )}
          <div className="table-scroll">
            <table className="data-table" data-testid="envio-inco-table">
              <thead>
                <tr>
                  <th>{t("envioColIncoterm")}</th>
                  <th>{t("envioColMeaning")}</th>
                  <th>{t("envioColTotal")}</th>
                  <th>{t("envioColUnit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className={r.key === selected ? "row-target" : undefined}
                    onClick={() =>
                      setConfig({
                        selectedIncoterm: r.key,
                        view: "preparar_envio",
                      })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <b>{r.key}</b>
                    </td>
                    <td>{r.plainEs}</td>
                    <td>{fmtEur(r.totalEur)}</td>
                    <td>
                      {new Intl.NumberFormat("es-ES", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 2,
                      }).format(r.unitEur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "documentos" ? (
        <div className="envio-panel" data-testid="envio-documentos">
          <p className="pill warn" data-testid="envio-docs-soon">
            {t("envioDocsSoon")}
          </p>
          <p className="muted">{t("envioDocsBody")}</p>
        </div>
      ) : null}

      <footer className="page-nav-row">
        <PermalinkLink view="plan_4p" className="btn">
          {t("stepPlan4p")}
        </PermalinkLink>
        <PermalinkLink view="analisis" className="btn">
          {t("stepResultados")}
        </PermalinkLink>
      </footer>
    </section>
  );
}
