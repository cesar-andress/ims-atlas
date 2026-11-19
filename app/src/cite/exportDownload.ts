/** Client-side download helpers (never upload). */

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** Export an ECharts instance (passed as any chart with getDataURL). */
export function downloadChartPng(
  chart: { getDataURL: (opts: object) => string },
  filename: string,
): void {
  const dataUrl = chart.getDataURL({
    type: "png",
    pixelRatio: 2,
    backgroundColor: "#fff",
  });
  downloadDataUrl(filename, dataUrl);
}

export function downloadChartSvg(
  chart: { getDataURL: (opts: object) => string },
  filename: string,
): void {
  const dataUrl = chart.getDataURL({ type: "svg", backgroundColor: "#fff" });
  downloadDataUrl(filename, dataUrl);
}

export function rankingToCsv(
  rows: { iso3: string; score: number; rank: number }[],
): string {
  const lines = ["iso3,rank,score"];
  for (const r of rows) {
    lines.push(`${r.iso3},${r.rank},${r.score}`);
  }
  return lines.join("\n") + "\n";
}
