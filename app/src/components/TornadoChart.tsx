import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import type { TornadoBar } from "@ims-atlas/core";
import { useEchartsHost } from "../charts/useEchartsHost";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer, SVGRenderer]);

type Props = {
  bars: TornadoBar[];
  onReady?: (chart: echarts.ECharts) => void;
};

/** Factor weight ±50% tornado (mean |Δrank|). */
export function TornadoChart({ bars, onReady }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const { chart } = useEchartsHost(elRef, onReady, "svg");
  const factors = bars.filter((b) => b.level === "factor");

  useEffect(() => {
    if (!chart) return;
    const factorBars = bars.filter((b) => b.level === "factor");
    const labels = factorBars.map((b) => b.id);
    chart.setOption(
      {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { left: 72, right: 24, top: 16, bottom: 32 },
        xAxis: { type: "value", name: "mean |Δrank|" },
        yAxis: { type: "category", data: labels, inverse: true },
        series: [
          {
            name: "−50%",
            type: "bar",
            data: factorBars.map((b) => -b.lowDelta),
            itemStyle: { color: "#6b8cae" },
          },
          {
            name: "+50%",
            type: "bar",
            data: factorBars.map((b) => b.highDelta),
            itemStyle: { color: "#c45c26" },
          },
        ],
      },
      true,
    );
  }, [bars, chart]);

  return (
    <div
      ref={elRef}
      className="chart-box"
      data-testid="tornado-chart"
      role="img"
      aria-label="Tornado sensitivity of factor weights"
      style={{ width: "100%", height: Math.max(220, factors.length * 36) }}
    />
  );
}
