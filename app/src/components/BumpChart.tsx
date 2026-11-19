import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type BumpSeries = {
  iso3: string;
  ranks: (number | null)[];
};

type Props = {
  years: number[];
  series: BumpSeries[];
  onReady?: (chart: echarts.ECharts) => void;
};

/** Rank bump chart (y-axis inverted: rank 1 at top). */
export function BumpChart({ years, series, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.setOption({
      tooltip: { trigger: "axis" },
      legend: { type: "scroll", top: 0 },
      grid: { left: 48, right: 24, top: 48, bottom: 40 },
      xAxis: {
        type: "category",
        data: years.map(String),
        name: "Year",
      },
      yAxis: {
        type: "value",
        inverse: true,
        min: 1,
        name: "Rank",
        minInterval: 1,
      },
      series: series.map((s) => ({
        name: s.iso3,
        type: "line",
        data: s.ranks,
        showSymbol: true,
        connectNulls: false,
      })),
    });
    onReadyRef.current?.(chart);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [years, series]);

  return (
    <div
      ref={ref}
      className="chart-box"
      data-testid="bump-chart"
      role="img"
      aria-label="Rank bump chart over years"
      style={{ width: "100%", height: 420 }}
    />
  );
}
