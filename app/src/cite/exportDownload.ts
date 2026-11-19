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
  factorScores?: Record<string, Record<string, number>>,
): string {
  const factorKeys = factorScores
    ? [...new Set(Object.values(factorScores).flatMap((m) => Object.keys(m)))].sort()
    : [];
  const header = ["iso3", "rank", "score", ...factorKeys];
  const lines = [header.join(",")];
  for (const r of rows) {
    const cols = [r.iso3, String(r.rank), String(r.score)];
    for (const f of factorKeys) {
      cols.push(String(factorScores?.[r.iso3]?.[f] ?? ""));
    }
    lines.push(cols.join(","));
  }
  return lines.join("\n") + "\n";
}
