import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { useEchartsHost } from "../charts/useEchartsHost";

echarts.use([
  BarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
  SVGRenderer,
]);

type Point = { name: string; value: number };

type Props = {
  title: string;
  series: Point[];
  secondary?: Point[];
  /** When false, ChartFrame owns the visible title (avoids double heading). */
  showChartTitle?: boolean;
  onReady?: (chart: echarts.ECharts) => void;
};

export function Top10Chart({
  title,
  series,
  secondary,
  showChartTitle = false,
  onReady,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const { chart } = useEchartsHost(elRef, onReady, "svg");

  useEffect(() => {
    if (!chart) return;
    const cats = series.map((s) => s.name);
    chart.setOption(
      {
        title: showChartTitle
          ? { text: title, left: "center", textStyle: { fontSize: 13 } }
          : undefined,
        tooltip: { trigger: "axis" },
        legend: secondary ? { top: showChartTitle ? 28 : 8 } : undefined,
        grid: {
          left: 48,
          right: 20,
          top: showChartTitle ? 56 : secondary ? 40 : 24,
          bottom: 36,
        },
        xAxis: {
          type: "category",
          data: cats,
          axisLabel: { fontSize: 12 },
        },
        yAxis: {
          type: "value",
          splitLine: { lineStyle: { type: "dashed", opacity: 0.45 } },
        },
        series: [
          {
            name: "primary",
            type: "bar",
            barMaxWidth: 36,
            itemStyle: { borderRadius: [3, 3, 0, 0] },
            data: series.map((s) => s.value),
          },
          ...(secondary
            ? [
                {
                  name: "secondary",
                  type: "bar" as const,
                  barMaxWidth: 36,
                  itemStyle: { borderRadius: [3, 3, 0, 0] },
                  data: secondary.map((s) => s.value),
                },
              ]
            : []),
        ],
      },
      true,
    );
  }, [title, series, secondary, showChartTitle, chart]);

  return (
    <div
      ref={elRef}
      className="top10-chart"
      data-testid="top10-chart"
      style={{ width: "100%", height: 300 }}
      role="img"
      aria-label={title}
    />
  );
}
