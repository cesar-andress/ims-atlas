import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import type { StrategicMatrixResult } from "@ims-atlas/core";
import { useEchartsHost } from "../charts/useEchartsHost";
import { countryLabel } from "../design/formatLocale";
import { useTranslation } from "../i18n";

echarts.use([
  ScatterChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  LegendComponent,
  CanvasRenderer,
  SVGRenderer,
]);

const QUAD_COLORS: Record<number, string> = {
  1: "#0b5f4a",
  2: "#2a6f97",
  3: "#8a8a80",
  4: "#b85c38",
};

type Props = {
  matrix: StrategicMatrixResult;
  onReady?: (chart: echarts.ECharts) => void;
};

/** Axis span from p1–p99 with margin so outliers (e.g. BHS) stay inside the plot. */
function axisExtent(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => {
    const i = Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor((p / 100) * (sorted.length - 1))),
    );
    return sorted[i]!;
  };
  const lo = at(1);
  const hi = at(99);
  const dataMin = sorted[0]!;
  const dataMax = sorted[sorted.length - 1]!;
  // Prefer full data range; pad so points and right-side labels are not clipped.
  const span = Math.max(dataMax - dataMin, hi - lo, 1e-6);
  const pad = span * 0.12;
  return {
    min: Math.min(dataMin, lo) - pad,
    max: Math.max(dataMax, hi) + pad,
  };
}

export function StrategicScatter({ matrix, onReady }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const elRef = useRef<HTMLDivElement | null>(null);
  const { chart } = useEchartsHost(elRef, onReady, "svg");

  useEffect(() => {
    if (!chart) return;
    const loc = lang === "es" ? "es" : "en";
    const qName = (q: number) => t(`quadrantQ${q}` as "quadrantQ1");
    const top15 = new Set(
      [...matrix.points]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 15)
        .map((p) => p.iso3),
    );
    const xExt = axisExtent(matrix.points.map((p) => p.fit));
    const yExt = axisExtent(matrix.points.map((p) => p.attractiveness));

    const series = ([1, 2, 3, 4] as const).map((q) => ({
      name: qName(q),
      type: "scatter" as const,
      data: matrix.points
        .filter((p) => p.quadrant === q)
        .map((p) => ({
          value: [p.fit, p.attractiveness, p.score],
          name: countryLabel(p.iso3, loc),
          iso3: p.iso3,
          rank: p.rank,
          labelTop: top15.has(p.iso3),
        })),
      symbolSize: 6,
      itemStyle: {
        color: QUAD_COLORS[q],
        opacity: 0.8,
        borderColor: "#fff",
        borderWidth: 1,
      },
      label: {
        show: true,
        formatter: (p: { data?: { labelTop?: boolean; name?: string } }) =>
          p.data?.labelTop ? (p.data.name ?? "") : "",
        fontSize: 10,
        position: "top" as const,
        distance: 4,
      },
      // Keep country names inside the plot (EXTRA-3: no clipped labels).
      labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
    }));

    chart.setOption(
      {
        animation: false,
        tooltip: {
          formatter: (p: {
            name?: string;
            value?: number[];
            seriesName?: string;
            data?: { rank?: number; iso3?: string };
          }) => {
            const v = p.value ?? [];
            const label = p.name ?? p.data?.iso3 ?? "";
            return `${label}<br/>${t("fit")}=${v[0]?.toFixed(3)}<br/>${t("attractiveness")}=${v[1]?.toFixed(3)}<br/>${p.seriesName} · #${p.data?.rank ?? "?"}`;
          },
        },
        legend: {
          top: 0,
          left: "center",
          type: "scroll",
          width: "90%",
        },
        // containLabel + generous right/bottom so axis names and edge points fit.
        grid: {
          left: 12,
          right: 28,
          top: 52,
          bottom: 12,
          containLabel: true,
        },
        xAxis: {
          name: t("fit"),
          nameLocation: "middle",
          nameGap: 30,
          type: "value",
          min: xExt.min,
          max: xExt.max,
          scale: false,
          splitLine: { show: true },
        },
        yAxis: {
          name: t("attractiveness"),
          nameLocation: "middle",
          nameGap: 42,
          type: "value",
          min: yExt.min,
          max: yExt.max,
          scale: false,
          splitLine: { show: true },
        },
        series: series.map((s, idx) =>
          idx === 0
            ? {
                ...s,
                markLine: {
                  symbol: "none",
                  lineStyle: { type: "dashed", color: "#666" },
                  data: [{ xAxis: matrix.cutFit }, { yAxis: matrix.cutAttractiveness }],
                  label: { show: false },
                },
              }
            : s,
        ),
      },
      true,
    );
    chart.resize();
  }, [matrix, chart, t, lang]);

  return (
    <div
      className="strategic-scatter"
      data-testid="strategic-scatter"
      ref={elRef}
      role="img"
      aria-label={t("matrixScatterAria")}
    />
  );
}
