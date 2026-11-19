import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { TornadoBar } from "@ims-atlas/core";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

type Props = {
  bars: TornadoBar[];
};

/** Factor weight ±50% tornado (mean |Δrank|). */
export function TornadoChart({ bars }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const factors = bars.filter((b) => b.level === "factor");

  useEffect(() => {
    if (!ref.current) return;
    const labels = factors.map((b) => b.id);
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 72, right: 24, top: 16, bottom: 32 },
      xAxis: { type: "value", name: "mean |Δrank|" },
      yAxis: { type: "category", data: labels, inverse: true },
      series: [
        {
          name: "−50%",
          type: "bar",
          data: factors.map((b) => -b.lowDelta),
          itemStyle: { color: "#6b8cae" },
        },
        {
          name: "+50%",
          type: "bar",
          data: factors.map((b) => b.highDelta),
          itemStyle: { color: "#c45c26" },
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- factors derived from bars
  }, [bars]);

  return (
    <div
      ref={ref}
      className="chart-box"
      data-testid="tornado-chart"
      role="img"
      aria-label="Tornado sensitivity of factor weights"
      style={{ width: "100%", height: Math.max(220, factors.length * 36) }}
    />
  );
}
