import { useEffect, useRef, type RefObject } from "react";
import * as echarts from "echarts/core";

/**
 * Create one ECharts instance for the element lifetime.
 * `onReady` is stored in a ref so parent inline lambdas do not dispose/recreate
 * the chart on every render (EXTRA-1 blank-matrix bug).
 */
export function useEchartsHost(
  elRef: RefObject<HTMLDivElement | null>,
  onReady: ((chart: echarts.ECharts) => void) | undefined,
  renderer: "svg" | "canvas" = "svg",
): RefObject<echarts.ECharts | null> {
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!elRef.current) return;
    const chart = echarts.init(elRef.current, undefined, { renderer });
    chartRef.current = chart;
    onReadyRef.current?.(chart);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
    // Intentionally once per mount — do not depend on onReady.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return chartRef;
}
