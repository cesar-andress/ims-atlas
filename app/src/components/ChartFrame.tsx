import type { ReactNode, RefObject } from "react";
import { ExportMenu } from "./ExportMenu";
import { useTranslation } from "../i18n";

type ChartHandle = { getDataURL: (opts: object) => string };

export type ChartFrameProps = {
  testIdPrefix: string;
  title: string;
  subtitle?: string;
  /** Short citation line built from variable source_ids (never a fixed string). */
  sourceLine?: string;
  chartRef?: RefObject<ChartHandle | null>;
  children: ReactNode;
  className?: string;
  /** Discrete on-screen credit (EXTRA-3 watermark). */
  showOnScreenCredit?: boolean;
  projectLine?: string;
  extraCredit?: string;
};

/**
 * Shared chart chrome: title, download menu (PNG 4× / SVG), on-screen source credit.
 * Reuses ExportMenu + imageExport — no new libraries.
 */
export function ChartFrame({
  testIdPrefix,
  title,
  subtitle,
  sourceLine,
  chartRef,
  children,
  className,
  showOnScreenCredit = true,
  projectLine,
  extraCredit,
}: ChartFrameProps) {
  const { t } = useTranslation();
  const creditParts = [projectLine, sourceLine, t("chartCreditAtlas")].filter(Boolean);

  return (
    <figure
      className={["chart-frame", className].filter(Boolean).join(" ")}
      data-testid={`chart-frame-${testIdPrefix}`}
      data-export-surface="chart"
    >
      <div className="chart-frame-head">
        <figcaption className="chart-frame-title">{title}</figcaption>
        {chartRef ? (
          <ExportMenu
            testIdPrefix={testIdPrefix}
            kind="chart"
            title={title}
            {...(subtitle ? { subtitle } : {})}
            {...(sourceLine ? { sourceLine } : {})}
            {...(extraCredit ? { extraCredit } : {})}
            chartRef={chartRef}
          />
        ) : null}
      </div>
      {subtitle ? <p className="muted small chart-frame-sub">{subtitle}</p> : null}
      <div className="chart-frame-body">{children}</div>
      {showOnScreenCredit ? (
        <p className="chart-frame-credit muted small" data-testid="chart-credit">
          {creditParts.join(" · ")}
        </p>
      ) : null}
    </figure>
  );
}
