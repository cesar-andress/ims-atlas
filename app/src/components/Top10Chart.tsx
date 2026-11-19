import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

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
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!elRef.current) return;
    // SVG renderer so PNG and SVG exports both work via getDataURL.
    const chart = echarts.init(elRef.current, undefined, { renderer: "svg" });
    chartRef.current = chart;
    onReady?.(chart);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [onReady]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const cats = series.map((s) => s.name);
    const option = {
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
    };
    chart.setOption(option, true);
  }, [title, series, secondary]);

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
