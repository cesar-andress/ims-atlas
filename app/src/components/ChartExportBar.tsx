import type { RefObject } from "react";
import {
  downloadChartPng,
  downloadChartSvg,
  downloadText,
} from "../cite/exportDownload";

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
};

/** Shared PNG / SVG / optional CSV export controls for chart views. */
export function ChartExportBar({
  testIdPrefix,
  chartRef,
  pngName,
  svgName,
  csv,
  className = "export-row",
}: Props) {
  return (
    <div className={className} data-testid={`${testIdPrefix}-exports`}>
      {chartRef && pngName ? (
        <button
          type="button"
          data-testid={`export-${testIdPrefix}-png`}
          onClick={() => {
            if (chartRef.current) downloadChartPng(chartRef.current, pngName);
          }}
        >
          PNG
        </button>
      ) : null}
      {chartRef && svgName ? (
        <button
          type="button"
          data-testid={`export-${testIdPrefix}-svg`}
          onClick={() => {
            if (chartRef.current) downloadChartSvg(chartRef.current, svgName);
          }}
        >
          SVG
        </button>
      ) : null}
      {csv ? (
        <button
          type="button"
          data-testid={`export-${testIdPrefix}-csv`}
          onClick={() => downloadText(csv.filename, csv.body, "text/csv")}
        >
          CSV
        </button>
      ) : null}
    </div>
  );
}
