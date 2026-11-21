import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  liquidateIncoterms,
  version as APP_VERSION,
  type IncotermMode,
  type LiquidationRow,
} from "@ims-atlas/core";
import { PermalinkLink } from "../components/PermalinkLink";
import { countryLabel } from "../design/formatLocale";
import { dataConfig } from "../dataConfig";
import {
  delayExtraEur,
  emptyProjectForm,
  formToLiquidationInput,
  joseExampleForm,
  type IncotermsFormState,
} from "../data/incotermsForm";
import { useTranslation } from "../i18n";
import { useAnalysis } from "../state/useAnalysis";
import { downloadBlob } from "../state/projectExport";
import { buildXlsx, readmeSheet, rowsToCsv } from "../export/xlsx";

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

function IncotermStaircase(props: {
  rows: LiquidationRow[];
  selected: string;
  fmt: (n: number) => string;
}) {
  const { rows, selected, fmt } = props;
  const max = Math.max(...rows.map((r) => r.totalEur), 1);
  return (
    <div className="envio-stair" data-testid="envio-stair">
      {rows.map((r) => {
        const pct = Math.max(4, (r.totalEur / max) * 100);
        const active = r.key === selected;
        return (
          <div
            key={r.key}
            className={`envio-stair-row${active ? " active" : ""}`}
            title={`${r.key}: ${fmt(r.totalEur)}`}
          >
            <span className="envio-stair-label">{r.key}</span>
            <div className="envio-stair-track">
              <div className="envio-stair-bar" style={{ width: `${pct}%` }} />
            </div>
            <span className="envio-stair-val">{fmt(r.totalEur)}</span>
          </div>
        );
      })}
    </div>
  );
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Step 6 — Contenedor, Incoterms (project data + Jose preset), Documentos, Syscomer.
 */
export function PrepararEnvio() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const { config, setConfig } = useAnalysis();
  const [tab, setTab] = useState<TabId>("incoterms");
  const [contType, setContType] = useState("40");
  const [palletL, setPalletL] = useState(1.2);
  const [palletW, setPalletW] = useState(0.8);
  const [layers, setLayers] = useState(2);
  const [unitsPerPallet, setUnitsPerPallet] = useState<number | null>(null);

  const originLabel = config.origin
    ? countryLabel(config.origin, lang)
    : t("chipChoose");
  const destLabel = config.targetMarket
    ? countryLabel(config.targetMarket, lang)
    : t("chipChoose");

  const [form, setForm] = useState<IncotermsFormState>(() =>
    emptyProjectForm({
      originIso3: config.origin,
      targetIso3: config.targetMarket,
      originLabel,
      destLabel,
    }),
  );

  // Refresh autofill when project origin / target changes (keep user costs).
  useEffect(() => {
    setForm((prev) => {
      if (prev.preset === "jose") return prev;
      const next = emptyProjectForm(
        {
          originIso3: config.origin,
          targetIso3: config.targetMarket,
          originLabel,
          destLabel,
        },
        prev.mode,
      );
      return {
        ...next,
        units: prev.units,
        exwUnitEur: prev.exwUnitEur,
        freightEur: prev.freightEur,
        insuranceEur: prev.insuranceEur,
        exportClearanceEur: prev.exportClearanceEur,
        importClearanceEur: prev.importClearanceEur,
        unloadEur: prev.unloadEur,
        delayDays: prev.delayDays,
        delayCostPerDayEur: prev.delayCostPerDayEur,
        mode: prev.mode,
      };
    });
  }, [config.origin, config.targetMarket, originLabel, destLabel]);

  const mode: IncotermMode = form.mode;
  const selected = config.selectedIncoterm ?? "DDP";

  const input = useMemo(() => formToLiquidationInput(form), [form]);
  const rows = useMemo(() => (input ? liquidateIncoterms(input) : []), [input]);
  const selectedRow = rows.find((r) => r.key === selected) ?? rows[rows.length - 1];
  const delayExtra = delayExtraEur(form);

  const cont =
    CONTAINER_PRESETS.find((c) => c.id === contType) ?? CONTAINER_PRESETS[1]!;
  const along = Math.max(1, Math.floor(cont.lengthM / palletL));
  const across = Math.max(1, Math.floor(cont.widthM / palletW));
  const floorPallets = along * across;
  const totalPallets = floorPallets * Math.max(1, layers);
  const projectUnits = form.units;
  const containersNeeded =
    projectUnits != null &&
    unitsPerPallet != null &&
    unitsPerPallet > 0 &&
    totalPallets > 0
      ? Math.ceil(projectUnits / (totalPallets * unitsPerPallet))
      : null;

  const fmtEur = (n: number, digits = 0) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: digits,
    }).format(n);

  function patchForm(patch: Partial<IncotermsFormState>) {
    setForm((prev) => ({ ...prev, ...patch, preset: patch.preset ?? prev.preset }));
  }

  function loadJose() {
    const next = joseExampleForm(mode);
    setForm(next);
    setConfig({
      incotermsMode: next.mode,
      selectedIncoterm: "DDP",
      view: "preparar_envio",
    });
  }

  function resetProject() {
    setForm(
      emptyProjectForm(
        {
          originIso3: config.origin,
          targetIso3: config.targetMarket,
          originLabel,
          destLabel,
        },
        mode,
      ),
    );
  }

  function downloadIncotermsXlsx() {
    if (!rows.length) return;
    const table = [
      ["incoterm", "meaning_es", "total_eur", "unit_eur", "days"],
      ...rows.map((r) => [
        r.key,
        r.plainEs,
        String(r.totalEur),
        String(r.unitEur),
        r.days != null ? String(r.days) : "",
      ]),
    ];
    const sources = [
      `Origen: ${form.originPlace}`,
      `Destino: ${form.destPlace}`,
      `Preset: ${form.preset}`,
      form.dutySource ? `Arancel: ${form.dutySource}` : "",
      form.vatSource ? `IVA: ${form.vatSource}` : "",
      form.fxSource ? `FX: ${form.fxSource}` : "",
    ].filter(Boolean);
    const blob = buildXlsx([
      readmeSheet({
        title: "IMS Atlas — liquidación Incoterms",
        appVersion: APP_VERSION,
        releaseId: dataConfig.release_version,
        exportDate: new Date().toISOString().slice(0, 10),
        sources,
      }),
      { name: "incoterms", rows: table },
    ]);
    downloadBlob(blob, "ims-atlas-incoterms.xlsx");
  }

  function downloadIncotermsCsv() {
    if (!rows.length) return;
    const body = rowsToCsv([
      ["incoterm", "meaning_es", "total_eur", "unit_eur", "days"],
      ...rows.map((r) => [
        r.key,
        r.plainEs,
        String(r.totalEur),
        String(r.unitEur),
        r.days != null ? String(r.days) : "",
      ]),
    ]);
    downloadBlob(
      new Blob([body], { type: "text/csv;charset=utf-8" }),
      "ims-atlas-incoterms.csv",
    );
  }

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
        <p className="envio-project-chip" data-testid="envio-project-context">
          <span>
            {t("chipOrigin")} <b>{originLabel}</b>
          </span>
          <span>
            {t("mercadoTarget")} <b>{destLabel}</b>
          </span>
          {config.year != null ? (
            <span>
              {t("chipYear")} <b>{config.year}</b>
            </span>
          ) : null}
        </p>
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
          <div className="envio-hero-stats">
            <div className="envio-stat">
              <span className="envio-stat-label">{t("envioContPallets")}</span>
              <strong data-testid="envio-cont-pallets">{totalPallets}</strong>
            </div>
            <div className="envio-stat">
              <span className="envio-stat-label">{t("envioContUnits")}</span>
              <strong data-testid="envio-cont-units">
                {projectUnits != null ? projectUnits : "—"}
              </strong>
            </div>
            <div className="envio-stat">
              <span className="envio-stat-label">{t("envioContNeed")}</span>
              <strong data-testid="envio-cont-need">
                {containersNeeded != null ? containersNeeded : "—"}
              </strong>
            </div>
          </div>
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
            <label className="field">
              <span>{t("envioUnitsPerPallet")}</span>
              <input
                type="number"
                min={1}
                data-testid="envio-units-per-pallet"
                value={unitsPerPallet ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) => setUnitsPerPallet(numOrNull(e.target.value))}
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
          {containersNeeded == null ? (
            <p className="muted small" data-testid="envio-cont-need-hint">
              {t("envioContNeedHint")}
            </p>
          ) : (
            <p data-testid="envio-cont-need-msg">
              {t("envioContNeedMsg")
                .replace("{n}", String(containersNeeded))
                .replace("{units}", String(projectUnits))}
            </p>
          )}
        </div>
      ) : null}

      {tab === "incoterms" ? (
        <div className="envio-panel" data-testid="envio-incoterms">
          <p className="muted">{t("envioIncoLead")}</p>
          <div className="envio-preset-row">
            <button
              type="button"
              className="btn"
              data-testid="envio-load-jose"
              onClick={loadJose}
            >
              {t("envioLoadJose")}
            </button>
            <button
              type="button"
              className="btn"
              data-testid="envio-reset-project"
              onClick={resetProject}
            >
              {t("envioResetProject")}
            </button>
            <button
              type="button"
              className="btn"
              data-testid="envio-download-xlsx"
              disabled={!rows.length}
              onClick={downloadIncotermsXlsx}
            >
              Excel
            </button>
            <button
              type="button"
              className="btn"
              data-testid="envio-download-csv"
              disabled={!rows.length}
              onClick={downloadIncotermsCsv}
            >
              CSV
            </button>
          </div>
          {form.preset === "jose" ? (
            <p className="pill" data-testid="envio-jose-preset-pill">
              {t("envioJosePresetOn")}
            </p>
          ) : null}

          <div className="envio-mode" role="group" aria-label={t("envioIncoMode")}>
            <button
              type="button"
              className={`btn${mode === "excel" ? " btn-primary" : ""}`}
              data-testid="envio-mode-excel"
              onClick={() => {
                patchForm({ mode: "excel" });
                setConfig({ incotermsMode: "excel", view: "preparar_envio" });
              }}
            >
              {t("envioModeExcel")}
            </button>
            <button
              type="button"
              className={`btn${mode === "corrected" ? " btn-primary" : ""}`}
              data-testid="envio-mode-corrected"
              onClick={() => {
                patchForm({ mode: "corrected" });
                setConfig({ incotermsMode: "corrected", view: "preparar_envio" });
              }}
            >
              {t("envioModeCorrected")}
            </button>
          </div>

          <div className="envio-form-grid" data-testid="envio-inco-form">
            <label className="field">
              <span>{t("envioFieldUnits")}</span>
              <input
                type="number"
                min={1}
                data-testid="envio-units"
                value={form.units ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) => patchForm({ units: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>{t("envioFieldExw")}</span>
              <input
                type="number"
                min={0}
                step={0.01}
                data-testid="envio-exw"
                value={form.exwUnitEur ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) => patchForm({ exwUnitEur: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>{t("envioFieldOrigin")}</span>
              <input
                type="text"
                data-testid="envio-origin-place"
                value={form.originPlace}
                onChange={(e) =>
                  patchForm({ originPlace: e.target.value.slice(0, 120) })
                }
              />
            </label>
            <label className="field">
              <span>{t("envioFieldDest")}</span>
              <input
                type="text"
                data-testid="envio-dest-place"
                value={form.destPlace}
                onChange={(e) => patchForm({ destPlace: e.target.value.slice(0, 120) })}
              />
            </label>
            <label className="field">
              <span>{t("envioFieldFreight")}</span>
              <input
                type="number"
                min={0}
                data-testid="envio-freight"
                value={form.freightEur ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) => patchForm({ freightEur: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>{t("envioFieldInsurance")}</span>
              <input
                type="number"
                min={0}
                data-testid="envio-insurance"
                value={form.insuranceEur ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) => patchForm({ insuranceEur: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>{t("envioFieldExportClear")}</span>
              <input
                type="number"
                min={0}
                data-testid="envio-export-clear"
                value={form.exportClearanceEur ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) =>
                  patchForm({ exportClearanceEur: numOrNull(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>{t("envioFieldImportClear")}</span>
              <input
                type="number"
                min={0}
                data-testid="envio-import-clear"
                value={form.importClearanceEur ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) =>
                  patchForm({ importClearanceEur: numOrNull(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>{t("envioFieldUnload")}</span>
              <input
                type="number"
                min={0}
                data-testid="envio-unload"
                value={form.unloadEur ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) => patchForm({ unloadEur: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>{t("envioFieldDuty")}</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                data-testid="envio-duty"
                value={form.dutyRate != null ? form.dutyRate * 100 : ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) => {
                  const pct = numOrNull(e.target.value);
                  patchForm({
                    dutyRate: pct == null ? null : pct / 100,
                    dutySource: undefined,
                  });
                }}
              />
              {form.dutySource ? (
                <span className="field-source" data-testid="envio-duty-source">
                  {form.dutySource}
                </span>
              ) : (
                <span className="field-source muted">{t("envioSourceMissing")}</span>
              )}
            </label>
            <label className="field">
              <span>{t("envioFieldVat")}</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                data-testid="envio-vat"
                value={form.vatRate != null ? form.vatRate * 100 : ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) => {
                  const pct = numOrNull(e.target.value);
                  patchForm({
                    vatRate: pct == null ? null : pct / 100,
                    vatSource: undefined,
                  });
                }}
              />
              {form.vatSource ? (
                <span className="field-source" data-testid="envio-vat-source">
                  {form.vatSource}
                </span>
              ) : (
                <span className="field-source muted">{t("envioSourceMissing")}</span>
              )}
            </label>
            <label className="field">
              <span>{t("envioFieldFx")}</span>
              <input
                type="number"
                min={0}
                step={0.0001}
                data-testid="envio-fx"
                value={form.fxRate ?? ""}
                placeholder={t("envioLeaveEmpty")}
                onChange={(e) =>
                  patchForm({ fxRate: numOrNull(e.target.value), fxSource: undefined })
                }
              />
              {form.fxSource ? (
                <span className="field-source" data-testid="envio-fx-source">
                  {form.fxSource}
                </span>
              ) : (
                <span className="field-source muted">{t("envioSourceMissing")}</span>
              )}
            </label>
            <label className="field">
              <span>{t("envioDelayDays")}</span>
              <input
                type="number"
                min={0}
                max={60}
                data-testid="envio-delay-days"
                value={form.delayDays}
                onChange={(e) =>
                  patchForm({
                    delayDays: Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                  })
                }
              />
            </label>
            <label className="field">
              <span>{t("envioDelayCostPerDay")}</span>
              <input
                type="number"
                min={0}
                data-testid="envio-delay-cost"
                value={form.delayCostPerDayEur ?? ""}
                placeholder={t("envioDelayCostHint")}
                onChange={(e) =>
                  patchForm({ delayCostPerDayEur: numOrNull(e.target.value) })
                }
              />
            </label>
          </div>

          {!rows.length ? (
            <p className="muted" role="status" data-testid="envio-need-units">
              {t("envioNeedUnits")}
            </p>
          ) : (
            <>
              {selectedRow ? (
                <article
                  className="envio-hero-card"
                  data-testid="envio-selected-summary"
                >
                  <p className="envio-hero-kicker">{selectedRow.key}</p>
                  <p className="envio-hero-total">
                    {fmtEur(selectedRow.totalEur + delayExtra)}
                  </p>
                  <p className="muted">
                    {fmtEur(selectedRow.unitEur, 2)}/{t("envioPerUnit")}
                    {selectedRow.days != null
                      ? ` · ${selectedRow.days + form.delayDays} ${t("envioDays")}`
                      : null}
                    {delayExtra > 0
                      ? ` · ${t("envioDelayExtra")} ${fmtEur(delayExtra)}`
                      : null}
                  </p>
                </article>
              ) : null}
              <IncotermStaircase
                rows={rows}
                selected={selected}
                fmt={(n) => fmtEur(n)}
              />
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
            </>
          )}
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
