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
  onReady?: (chart: echarts.ECharts) => void;
};

export function Top10Chart({ title, series, secondary, onReady }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useEchartsHost(elRef, onReady, "svg");

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const cats = series.map((s) => s.name);
    chart.setOption(
      {
        title: { text: title, left: "center", textStyle: { fontSize: 13 } },
        tooltip: { trigger: "axis" },
        legend: secondary ? { top: 24 } : undefined,
        grid: { left: 40, right: 16, top: 56, bottom: 32 },
        xAxis: { type: "category", data: cats },
        yAxis: { type: "value" },
        series: [
          {
            name: "primary",
            type: "bar",
            data: series.map((s) => s.value),
          },
          ...(secondary
            ? [
                {
                  name: "secondary",
                  type: "bar" as const,
                  data: secondary.map((s) => s.value),
                },
              ]
            : []),
        ],
      },
      true,
    );
  }, [title, series, secondary, chartRef]);

  return (
    <div
      ref={elRef}
      className="top10-chart"
      data-testid="top10-chart"
      style={{ width: "100%", height: 280 }}
      role="img"
      aria-label={title}
    />
  );
}
