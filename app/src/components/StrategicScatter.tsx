import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { StrategicMatrixResult } from "@ims-atlas/core";

echarts.use([
  ScatterChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  LegendComponent,
  CanvasRenderer,
]);

const QUAD_COLORS: Record<number, string> = {
  1: "#0b5f4a",
  2: "#2a6f97",
  3: "#8a8a80",
  4: "#b85c38",
};

type Props = { matrix: StrategicMatrixResult };

export function StrategicScatter({ matrix }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const series = ([1, 2, 3, 4] as const).map((q) => ({
      name: `Q${q}`,
      type: "scatter" as const,
      data: matrix.points
        .filter((p) => p.quadrant === q)
        .map((p) => ({
          value: [p.fit, p.attractiveness, p.score],
          name: p.iso3,
          rank: p.rank,
        })),
      symbolSize: (val: number[]) => 8 + 18 * (val[2] ?? 0),
      itemStyle: { color: QUAD_COLORS[q] },
      label: {
        show: true,
        formatter: (p: { name?: string }) => p.name ?? "",
        fontSize: 10,
        position: "right" as const,
      },
    }));

    chart.setOption({
      tooltip: {
        formatter: (p: {
          name?: string;
          value?: number[];
          seriesName?: string;
          data?: { rank?: number };
        }) => {
          const v = p.value ?? [];
          return `${p.name}<br/>Fit=${v[0]?.toFixed(3)}<br/>A=${v[1]?.toFixed(3)}<br/>score=${v[2]?.toFixed(3)}<br/>${p.seriesName} · #${p.data?.rank ?? "?"}`;
        },
      },
      legend: { top: 0 },
      grid: { left: 56, right: 24, top: 40, bottom: 48 },
      xAxis: {
        name: "Fit",
        type: "value",
        scale: true,
        splitLine: { show: true },
      },
      yAxis: {
        name: "Attractiveness",
        type: "value",
        scale: true,
        splitLine: { show: true },
      },
      series: series.map((s, idx) =>
        idx === 0
          ? {
              ...s,
              markLine: {
                symbol: "none",
                lineStyle: { type: "dashed", color: "#666" },
                data: [{ xAxis: matrix.cutFit }, { yAxis: matrix.cutAttractiveness }],
                label: { show: false },
              },
            }
          : s,
      ),
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [matrix]);

  return (
    <div
      className="strategic-scatter"
      data-testid="strategic-scatter"
      ref={ref}
      role="img"
      aria-label="Strategic matrix attractiveness versus fit"
    />
  );
}
