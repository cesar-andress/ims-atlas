import type { RefObject } from "react";
import { useState } from "react";
import { version as APP_VERSION } from "@ims-atlas/core";
import { downloadText } from "../cite/exportDownload";
import { dataConfig } from "../dataConfig";
import { exportChartPng, exportChartSvg, buildTextPdf } from "../export/imageExport";
import type { ImageExportMeta } from "../export/imageExport";
import { downloadBlob } from "../state/projectExport";
import { buildXlsx, readmeSheet, rowsToCsv } from "../export/xlsx";
import { useTranslation } from "../i18n";

type ChartHandle = { getDataURL: (opts: object) => string };

export type ExportMenuProps = {
  /** Unique prefix → data-testid export-menu-{id} and legacy export-{id}-png */
  testIdPrefix: string;
  kind: "chart" | "table";
  title: string;
  subtitle?: string;
  sourceLine?: string;
  chartRef?: RefObject<ChartHandle | null>;
  /** Table rows for CSV/XLSX (first row = header). */
  tableRows?: string[][];
  csvFilename?: string;
  xlsxFilename?: string;
  className?: string;
  extraCredit?: string;
  background?: "white" | "transparent";
};

function metaFrom(props: ExportMenuProps, releaseId: string): ImageExportMeta {
  return {
    title: props.title,
    ...(props.subtitle ? { subtitle: props.subtitle } : {}),
    ...(props.sourceLine ? { sourceLine: props.sourceLine } : {}),
    releaseId,
    background: props.background ?? "white",
    ...(props.extraCredit ? { extraCredit: props.extraCredit } : {}),
  };
}

/** Shared export control for every chart and table (Phase X). */
export function ExportMenu(props: ExportMenuProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const releaseId = dataConfig.release_version;
  const meta = metaFrom(props, releaseId);

  async function onPng(ratio: 1 | 2 | 4) {
    if (!props.chartRef?.current) return;
    setBusy(true);
    try {
      await exportChartPng(
        props.chartRef.current,
        `${props.testIdPrefix}-${ratio}x.png`,
        meta,
        ratio,
      );
    } finally {
      setBusy(false);
    }
  }

  function onSvg() {
    if (!props.chartRef?.current) return;
    exportChartSvg(props.chartRef.current, `${props.testIdPrefix}.svg`, meta);
  }

  function onPdfFigure() {
    const lines = [
      props.title,
      props.subtitle ?? "",
      props.sourceLine ?? "",
      `Data release ${releaseId}`,
      `App ${APP_VERSION}`,
      "",
      "Export the PNG/SVG from this menu for the figure bitmap.",
      meta.extraCredit ?? "",
    ];
    const blob = buildTextPdf(lines.filter(Boolean));
    downloadBlob(blob, `${props.testIdPrefix}.pdf`);
  }

  function onCsv() {
    if (!props.tableRows?.length) return;
    downloadText(
      props.csvFilename ?? `${props.testIdPrefix}.csv`,
      rowsToCsv(props.tableRows),
      "text/csv",
    );
  }

  function onXlsx() {
    if (!props.tableRows?.length) return;
    const leeme = readmeSheet({
      title: props.title,
      appVersion: APP_VERSION,
      releaseId,
      exportDate: new Date().toISOString().slice(0, 10),
      methodPlain: props.subtitle ?? "",
      sources: props.sourceLine ? [props.sourceLine] : [],
    });
    const blob = buildXlsx([leeme, { name: "data", rows: props.tableRows }]);
    downloadBlob(blob, props.xlsxFilename ?? `${props.testIdPrefix}.xlsx`);
  }

  return (
    <div
      className={props.className ?? "export-menu"}
      data-testid={`export-menu-${props.testIdPrefix}`}
      data-exportable={props.kind}
    >
      <span className="export-menu-label">{t("exportMenu")}</span>
      {props.kind === "chart" && props.chartRef ? (
        <>
          <button
            type="button"
            data-testid={`export-${props.testIdPrefix}-png`}
            disabled={busy}
            onClick={() => void onPng(2)}
          >
            PNG
          </button>
          <button
            type="button"
            data-testid={`export-${props.testIdPrefix}-png-1x`}
            disabled={busy}
            onClick={() => void onPng(1)}
          >
            1×
          </button>
          <button
            type="button"
            data-testid={`export-${props.testIdPrefix}-png-4x`}
            disabled={busy}
            onClick={() => void onPng(4)}
          >
            4×
          </button>
          <button
            type="button"
            data-testid={`export-${props.testIdPrefix}-svg`}
            onClick={onSvg}
          >
            SVG
          </button>
          <button
            type="button"
            data-testid={`export-${props.testIdPrefix}-pdf`}
            onClick={onPdfFigure}
          >
            PDF
          </button>
        </>
      ) : null}
      {props.tableRows ? (
        <>
          <button
            type="button"
            data-testid={`export-${props.testIdPrefix}-csv`}
            onClick={onCsv}
          >
            CSV
          </button>
          <button
            type="button"
            data-testid={`export-${props.testIdPrefix}-xlsx`}
            onClick={onXlsx}
          >
            XLSX
          </button>
        </>
      ) : null}
    </div>
  );
}
