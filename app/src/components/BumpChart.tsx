import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
  SVGRenderer,
]);

export type BumpSeries = {
  iso3: string;
  ranks: (number | null)[];
};

type Props = {
  years: number[];
  series: BumpSeries[];
  highlightYear?: number | null;
  onReady?: (chart: echarts.ECharts) => void;
};

/** Rank bump chart (y-axis inverted: rank 1 at top). */
export function BumpChart({ years, series, highlightYear, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
    chartRef.current = chart;
    onReadyRef.current?.(chart);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const markYear =
      highlightYear !== undefined && highlightYear !== null
        ? String(highlightYear)
        : null;
    chart.setOption(
      {
        tooltip: { trigger: "axis" },
        legend: { type: "scroll", top: 0 },
        grid: { left: 52, right: 28, top: 52, bottom: 44 },
        xAxis: {
          type: "category",
          data: years.map(String),
          name: "Year",
          nameLocation: "middle",
          nameGap: 28,
        },
        yAxis: {
          type: "value",
          inverse: true,
          min: 1,
          name: "Rank",
          minInterval: 1,
          splitLine: { lineStyle: { type: "dashed", opacity: 0.4 } },
        },
        series: series.map((s, idx) => ({
          name: s.iso3,
          type: "line",
          data: s.ranks,
          showSymbol: true,
          symbolSize: 7,
          connectNulls: false,
          ...(idx === 0 && markYear
            ? {
                markLine: {
                  symbol: "none",
                  label: { formatter: markYear, position: "end" },
                  lineStyle: { type: "dashed", color: "#0b5f4a", width: 1.5 },
                  data: [{ xAxis: markYear }],
                },
              }
            : { markLine: { data: [] } }),
        })),
      },
      { notMerge: false },
    );
  }, [years, series, highlightYear]);

  return (
    <div
      ref={ref}
      className="chart-box bump-chart"
      data-testid="bump-chart"
      role="img"
      aria-label="Rank bump chart over years"
    />
  );
}
