import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type Props = {
  title: string;
  factors: string[];
  values: Record<string, number>;
  compare?: Record<string, number> | undefined;
  compareLabel?: string | undefined;
};

export function FactorBars({ title, factors, values, compare, compareLabel }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const series: object[] = [
      {
        name: title,
        type: "bar",
        data: factors.map((f) => values[f] ?? 0),
      },
    ];
    if (compare) {
      series.push({
        name: compareLabel ?? "B",
        type: "bar",
        data: factors.map((f) => compare[f] ?? 0),
      });
    }
    chart.setOption({
      tooltip: { trigger: "axis" },
      legend: { top: 0 },
      grid: { left: 48, right: 16, top: 36, bottom: 48 },
      xAxis: {
        type: "category",
        data: factors,
        axisLabel: { rotate: 30, fontSize: 10 },
      },
      yAxis: { type: "value", name: "factor score" },
      series,
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [title, factors, values, compare, compareLabel]);

  return (
    <div
      className="factor-bars"
      data-testid="factor-bars"
      ref={ref}
      role="img"
      aria-label={title}
    />
  );
}
