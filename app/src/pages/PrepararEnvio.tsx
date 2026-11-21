import { useMemo, useState, type ReactNode } from "react";
import {
  JOSE_CORRECTED_DDP_TOTAL,
  JOSE_DEFAULT_INPUT,
  JOSE_EXCEL_DDP_TOTAL,
  JOSE_EXCEL_EXW_TOTAL,
  liquidateIncoterms,
  type IncotermMode,
} from "@ims-atlas/core";
import { PermalinkLink } from "../components/PermalinkLink";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";

type TabId = "contenedor" | "incoterms" | "documentos" | "syscomer";

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

function ContainerSketch(props: {
  along: number;
  across: number;
  layers: number;
  floorPallets: number;
  totalPallets: number;
}) {
  const { along, across, layers, floorPallets, totalPallets } = props;
  const cellW = 28;
  const cellH = 18;
  const pad = 12;
  const w = pad * 2 + along * cellW;
  const h = pad * 2 + across * cellH + 28;
  const rects: ReactNode[] = [];
  let k = 0;
  for (let j = 0; j < across; j++) {
    for (let i = 0; i < along; i++) {
      const x = pad + i * cellW;
      const y = pad + j * cellH;
      const on = k < floorPallets;
      rects.push(
        <rect
          key={`${i}-${j}`}
          x={x}
          y={y}
          width={cellW - 2}
          height={cellH - 2}
          rx={2}
          fill={on ? "var(--primary)" : "var(--soft)"}
          opacity={on ? 0.85 : 0.25}
        />,
      );
      k += 1;
    }
  }
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      role="img"
      aria-label={`${along} by ${across}, ${totalPallets} pallets`}
      data-testid="envio-cont-svg"
    >
      <rect
        x={2}
        y={2}
        width={w - 4}
        height={pad * 2 + across * cellH - 2}
        fill="none"
        stroke="var(--border)"
        strokeWidth={2}
        rx={6}
      />
      {rects}
      <text x={pad} y={h - 8} fontSize={11} fill="var(--ink-3)">
        {along}×{across} × {layers} = {totalPallets}
      </text>
    </svg>
  );
}

/**
 * Step 6 — Contenedor, Incoterms (Jose), Documentos (Próximamente), ideas Syscomer.
 */
export function PrepararEnvio() {
  const { t } = useTranslation();
  const { config, setConfig } = useAnalysis();
  const [tab, setTab] = useState<TabId>("incoterms");
  const [contType, setContType] = useState("40");
  const [palletL, setPalletL] = useState(1.2);
  const [palletW, setPalletW] = useState(0.8);
  const [layers, setLayers] = useState(2);
  const [delayDays, setDelayDays] = useState(0);

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

  const selectedRow = rows.find((r) => r.key === selected) ?? rows[rows.length - 1]!;
  const delayCost = delayDays * 75; // illustrative demurrage stub €/day (labelled as example)

  const cont =
    CONTAINER_PRESETS.find((c) => c.id === contType) ?? CONTAINER_PRESETS[1]!;
  const along = Math.max(1, Math.floor(cont.lengthM / palletL));
  const across = Math.max(1, Math.floor(cont.widthM / palletW));
  const floorPallets = along * across;
  const totalPallets = floorPallets * Math.max(1, layers);

  const fmtEur = (n: number, digits = 0) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: digits,
    }).format(n);

  const joseOk =
    mode === "excel"
      ? Math.abs(
          (rows.find((r) => r.key === "EXW")?.totalEur ?? 0) - JOSE_EXCEL_EXW_TOTAL,
        ) < 0.5 &&
        Math.abs(
          (rows.find((r) => r.key === "DDP")?.totalEur ?? 0) - JOSE_EXCEL_DDP_TOTAL,
        ) < 0.5
      : Math.abs(
          (rows.find((r) => r.key === "EXW")?.totalEur ?? 0) - JOSE_EXCEL_EXW_TOTAL,
        ) < 0.5 &&
        Math.abs(
          (rows.find((r) => r.key === "DDP")?.totalEur ?? 0) - JOSE_CORRECTED_DDP_TOTAL,
        ) < 0.5;

  const tabs: { id: TabId; label: string }[] = [
    { id: "contenedor", label: t("envioTabContenedor") },
    { id: "incoterms", label: t("envioTabIncoterms") },
    { id: "documentos", label: t("envioTabDocumentos") },
    { id: "syscomer", label: t("envioTabSyscomer") },
  ];

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
        {tabs.map(({ id, label }) => (
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
          <ContainerSketch
            along={along}
            across={across}
            layers={Math.max(1, layers)}
            floorPallets={floorPallets}
            totalPallets={totalPallets}
          />
          <p data-testid="envio-cont-result">
            {t("envioContResult")
              .replace("{floor}", String(floorPallets))
              .replace("{total}", String(totalPallets))
              .replace("{along}", String(along))
              .replace("{across}", String(across))}
          </p>
          <p className="muted small">{t("envioContJoseHint")}</p>
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
          <p
            className={`pill${joseOk ? " ok" : " warn"}`}
            data-testid="envio-jose-badge"
          >
            {mode === "excel" ? t("envioJoseBadge") : t("envioCorrectedBadge")}
          </p>
          <p data-testid="envio-selected-summary">
            {selectedRow.key}: {fmtEur(selectedRow.totalEur)} ·{" "}
            {fmtEur(selectedRow.unitEur, 2)}/{t("envioPerUnit")}
            {selectedRow.days != null
              ? ` · ${selectedRow.days + delayDays} ${t("envioDays")}`
              : null}
            {delayDays > 0
              ? ` · ${t("envioDelayCost")} ${fmtEur(selectedRow.totalEur + delayCost)}`
              : null}
          </p>
          <label className="field">
            <span>{t("envioDelayDays")}</span>
            <input
              type="number"
              min={0}
              max={60}
              value={delayDays}
              data-testid="envio-delay-days"
              onChange={(e) =>
                setDelayDays(Math.max(0, Math.trunc(Number(e.target.value)) || 0))
              }
            />
          </label>
          <div className="table-scroll">
            <table className="data-table" data-testid="envio-inco-table">
              <thead>
                <tr>
                  <th>{t("envioColIncoterm")}</th>
                  <th>{t("envioColMeaning")}</th>
                  <th>{t("envioColTotal")}</th>
                  <th>{t("envioColUnit")}</th>
                  <th>{t("envioColDays")}</th>
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
                    <td>{fmtEur(r.unitEur, 2)}</td>
                    <td>{r.days ?? "—"}</td>
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
          <ul className="envio-docs-list">
            <li>{t("envioDocsItemInvoice")}</li>
            <li>{t("envioDocsItemPacking")}</li>
            <li>{t("envioDocsItemOrigin")}</li>
          </ul>
        </div>
      ) : null}

      {tab === "syscomer" ? (
        <div className="envio-panel" data-testid="envio-syscomer">
          <p className="muted">{t("envioSyscomerLead")}</p>
          <ol className="envio-syscomer-list" data-testid="envio-syscomer-list">
            {(
              [
                ["envioSys1Title", "envioSys1Body", "live"],
                ["envioSys2Title", "envioSys2Body", "pending"],
                ["envioSys3Title", "envioSys3Body", "pending"],
                ["envioSys4Title", "envioSys4Body", "live"],
                ["envioSys5Title", "envioSys5Body", "pending"],
                ["envioSys6Title", "envioSys6Body", "pending"],
                ["envioSys7Title", "envioSys7Body", "partial"],
                ["envioSys8Title", "envioSys8Body", "pending"],
                ["envioSys9Title", "envioSys9Body", "pending"],
              ] as const
            ).map(([titleKey, bodyKey, status], idx) => (
              <li key={titleKey} data-testid={`envio-sys-item-${idx + 1}`}>
                <span
                  className={`pill${status === "live" ? " ok" : status === "partial" ? "" : " warn"}`}
                >
                  {status === "live"
                    ? t("envioSysStatusLive")
                    : status === "partial"
                      ? t("envioSysStatusPartial")
                      : t("envioSysStatusPending")}
                </span>{" "}
                <b>{t(titleKey)}</b>
                {" — "}
                {t(bodyKey)}
              </li>
            ))}
          </ol>
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
