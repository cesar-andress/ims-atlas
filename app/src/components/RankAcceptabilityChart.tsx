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
  alternatives: string[];
  /** acceptability[alt][rank-1] */
  acceptability: number[][];
  /** Show top-N alternatives by P(rank=1). */
  topN?: number;
};

/** Stacked rank-acceptability bars (SMAA). */
export function RankAcceptabilityChart({
  alternatives,
  acceptability,
  topN = 12,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const order = alternatives
      .map((iso, i) => ({ iso, i, p1: acceptability[i]?.[0] ?? 0 }))
      .sort((a, b) => b.p1 - a.p1)
      .slice(0, topN);
    const nRanks = Math.min(10, acceptability[0]?.length ?? 0);
    const series = Array.from({ length: nRanks }, (_, r) => ({
      name: `R${r + 1}`,
      type: "bar" as const,
      stack: "rank",
      emphasis: { focus: "series" as const },
      data: order.map((o) => acceptability[o.i]![r] ?? 0),
    }));
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { type: "scroll", top: 0 },
      grid: { left: 48, right: 16, top: 40, bottom: 48 },
      xAxis: {
        type: "category",
        data: order.map((o) => o.iso),
        axisLabel: { rotate: 45 },
      },
      yAxis: { type: "value", max: 1, name: "P(rank)" },
      series,
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [alternatives, acceptability, topN]);

  return (
    <div
      ref={ref}
      className="chart-box"
      data-testid="smaa-acceptability-chart"
      role="img"
      aria-label="SMAA stacked rank acceptability"
      style={{ width: "100%", height: 360 }}
    />
  );
}
