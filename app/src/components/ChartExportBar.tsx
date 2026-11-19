import type { RefObject } from "react";
import { ExportMenu } from "./ExportMenu";

type ChartHandle = { getDataURL: (opts: object) => string };

type Props = {
  /** Prefix for data-testid: `${testIdPrefix}-png` etc. */
  testIdPrefix: string;
  chartRef?: RefObject<ChartHandle | null>;
  pngName?: string;
  svgName?: string;
  /** When set, shows a CSV button that downloads this text. */
  csv?: { filename: string; body: string };
  className?: string;
  title?: string;
  subtitle?: string;
};

/** @deprecated Prefer ExportMenu; kept as a thin wrapper for existing call sites. */
export function ChartExportBar({
  testIdPrefix,
  chartRef,
  csv,
  className = "export-row",
  title,
  subtitle,
}: Props) {
  const tableRows = csv
    ? csv.body
        .trimEnd()
        .split("\n")
        .map((line) => line.split(","))
    : undefined;

  return (
    <ExportMenu
      testIdPrefix={testIdPrefix}
      kind={chartRef ? "chart" : "table"}
      title={title ?? testIdPrefix}
      {...(subtitle ? { subtitle } : {})}
      {...(chartRef ? { chartRef } : {})}
      {...(tableRows
        ? {
            tableRows,
            ...(csv?.filename ? { csvFilename: csv.filename } : {}),
          }
        : {})}
      className={className}
    />
  );
}
