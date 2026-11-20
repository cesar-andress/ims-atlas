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

type Props = {
  alternatives: string[];
  /** acceptability[alt][rank-1] */
  acceptability: number[][];
  /** Show top-N alternatives by P(rank=1). */
  topN?: number;
  onReady?: (chart: echarts.ECharts) => void;
};

/** Stacked rank-acceptability bars (SMAA). */
export function RankAcceptabilityChart({
  alternatives,
  acceptability,
  topN = 12,
  onReady,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const { chart } = useEchartsHost(elRef, onReady, "svg");

  useEffect(() => {
    if (!chart) return;
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
    chart.setOption(
      {
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
      },
      true,
    );
  }, [alternatives, acceptability, topN, chart]);

  return (
    <div
      ref={elRef}
      className="chart-box"
      data-testid="smaa-acceptability-chart"
      role="img"
      aria-label="SMAA stacked rank acceptability"
      style={{ width: "100%", height: 360 }}
    />
  );
}
