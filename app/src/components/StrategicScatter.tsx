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

export function StrategicScatter({ matrix, onReady }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("es") ? "es" : "en";
  const elRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useEchartsHost(elRef, onReady, "svg");

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const loc = lang === "es" ? "es" : "en";
    const qName = (q: number) => t(`quadrantQ${q}` as "quadrantQ1");
    const top15 = new Set(
      [...matrix.points]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 15)
        .map((p) => p.iso3),
    );
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
        position: "right" as const,
      },
    }));

    chart.setOption(
      {
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
        legend: { top: 0 },
        grid: { left: 64, right: 32, top: 48, bottom: 56 },
        xAxis: {
          name: t("fit"),
          type: "value",
          scale: true,
          splitLine: { show: true },
        },
        yAxis: {
          name: t("attractiveness"),
          type: "value",
          scale: true,
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
  }, [matrix, chartRef, t, lang]);

  return (
    <div
      className="strategic-scatter"
      data-testid="strategic-scatter"
      ref={elRef}
      role="img"
      aria-label={t("matrixScatterAria")}
      style={{ width: "100%", minHeight: 560, height: 560 }}
    />
  );
}
