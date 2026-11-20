import { useEffect, useRef, useState, type RefObject } from "react";
import * as echarts from "echarts/core";

export type EchartsHost = {
  /** Live instance; null while disposed / before first init. Depend on this in setOption effects. */
  chart: echarts.ECharts | null;
  /** Stable ref for export menus (same object identity across renders). */
  chartRef: RefObject<echarts.ECharts | null>;
};

/**
 * Create one ECharts instance for the element lifetime.
 * - `onReady` is stored in a ref so parent inline lambdas do not dispose/recreate
 *   the chart on every render (EXTRA-1 blank-matrix bug).
 * - `chart` state is set after init (and cleared on dispose) so option effects
 *   re-run after React Strict Mode's mount → dispose → remount cycle.
 */
export function useEchartsHost(
  elRef: RefObject<HTMLDivElement | null>,
  onReady: ((chart: echarts.ECharts) => void) | undefined,
  renderer: "svg" | "canvas" = "svg",
): EchartsHost {
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [chart, setChart] = useState<echarts.ECharts | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!elRef.current) return;
    const instance = echarts.init(elRef.current, undefined, { renderer });
    chartRef.current = instance;
    setChart(instance);
    onReadyRef.current?.(instance);
    const onResize = () => instance.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      instance.dispose();
      chartRef.current = null;
      setChart(null);
    };
    // Intentionally once per mount — do not depend on onReady.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { chart, chartRef };
}
