import { ATLAS_EXPORT_CREDIT, ATLAS_PNG_CREDIT_KEYWORD } from "./credit";
import { downloadDataUrl, downloadText } from "../cite/exportDownload";

export type ImageExportMeta = {
  title: string;
  subtitle?: string;
  sourceLine?: string;
  releaseId: string;
  /** ISO date YYYY-MM-DD; omit only in tests that inject a fixed stamp. */
  exportDate?: string;
  background?: "white" | "transparent";
  /** Extra attribution (e.g. basemap licence). */
  extraCredit?: string;
};

function todayIso(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function creditFooter(meta: ImageExportMeta): string {
  const date = meta.exportDate ?? todayIso();
  const parts = [ATLAS_EXPORT_CREDIT];
  if (meta.releaseId) parts.push(`Datos ${meta.releaseId}`);
  if (meta.sourceLine) parts.push(meta.sourceLine);
  if (meta.extraCredit) parts.push(meta.extraCredit);
  parts.push(date);
  return parts.join(" · ");
}

/** CRC32 for PNG chunks. */
function pngCrc(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ]);
}

/** Insert a tEXt chunk before IEND so credit is recoverable from PNG bytes. */
export function injectPngTextChunk(
  png: Uint8Array,
  keyword: string,
  text: string,
): Uint8Array {
  const enc = new TextEncoder();
  const key = enc.encode(keyword);
  const val = enc.encode(text);
  const data = new Uint8Array(key.length + 1 + val.length);
  data.set(key, 0);
  data[key.length] = 0;
  data.set(val, key.length + 1);
  const type = enc.encode("tEXt");
  const len = u32be(data.length);
  const crcBuf = new Uint8Array(type.length + data.length);
  crcBuf.set(type);
  crcBuf.set(data, type.length);
  const crc = u32be(pngCrc(crcBuf));
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  chunk.set(len, 0);
  chunk.set(type, 4);
  chunk.set(data, 8);
  chunk.set(crc, 8 + data.length);

  // Find IEND
  const sig = [0x49, 0x45, 0x4e, 0x44];
  let iend = -1;
  for (let i = 8; i < png.length - 8; i++) {
    if (
      png[i + 4] === sig[0] &&
      png[i + 5] === sig[1] &&
      png[i + 6] === sig[2] &&
      png[i + 7] === sig[3]
    ) {
      iend = i;
      break;
    }
  }
  if (iend < 0) return png;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, iend), 0);
  out.set(chunk, iend);
  out.set(png.subarray(iend), iend + chunk.length);
  return out;
}

export function pngBytesContainCredit(
  png: Uint8Array,
  credit = ATLAS_EXPORT_CREDIT,
): boolean {
  const text = new TextDecoder().decode(png);
  return text.includes(credit) || text.includes(ATLAS_PNG_CREDIT_KEYWORD);
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ToDataUrl(bytes: Uint8Array, mime: string): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return `data:${mime};base64,${btoa(s)}`;
}

const BAND = 56;

/** Draw title / subtitle / credit band onto a source canvas/image data URL. */
export async function composeChartPng(
  sourceDataUrl: string,
  meta: ImageExportMeta,
  pixelRatio: number,
): Promise<string> {
  const img = await loadImage(sourceDataUrl);
  const band = BAND * pixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height + band * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;

  const bg = meta.background === "transparent" ? null : "#ffffff";
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const pad = 10 * pixelRatio;
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `600 ${13 * pixelRatio}px "IBM Plex Sans", sans-serif`;
  ctx.fillText(meta.title, pad, 18 * pixelRatio);
  ctx.fillStyle = "#5c5c5c";
  ctx.font = `${11 * pixelRatio}px "IBM Plex Sans", sans-serif`;
  const sub = [meta.subtitle, meta.sourceLine, `data release ${meta.releaseId}`]
    .filter(Boolean)
    .join(" · ");
  if (sub) ctx.fillText(sub, pad, 34 * pixelRatio);

  ctx.drawImage(img, 0, band);

  ctx.fillStyle = "#8a8a8a";
  ctx.font = `${10 * pixelRatio}px "IBM Plex Sans", sans-serif`;
  const footer = creditFooter(meta);
  ctx.fillText(footer, pad, canvas.height - 12 * pixelRatio);

  const raw = canvas.toDataURL("image/png");
  const withMeta = injectPngTextChunk(
    dataUrlToUint8(raw),
    ATLAS_PNG_CREDIT_KEYWORD,
    creditFooter(meta),
  );
  return uint8ToDataUrl(withMeta, "image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

export function wrapSvgWithCredit(svgMarkup: string, meta: ImageExportMeta): string {
  const footer = creditFooter(meta);
  const escaped = footer
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const title = meta.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // If already a full svg, inject text elements before </svg>
  if (/<\/svg>/i.test(svgMarkup)) {
    const inject = [
      `<text x="12" y="18" font-size="13" font-family="sans-serif" fill="#1a1a1a">${title}</text>`,
      `<text data-atlas-credit="1" x="12" y="99%" font-size="10" font-family="sans-serif" fill="#8a8a8a">${escaped}</text>`,
    ].join("");
    return svgMarkup.replace(/<\/svg>/i, `${inject}</svg>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480"><text x="12" y="24">${title}</text><text data-atlas-credit="1" x="12" y="460" font-size="10" fill="#8a8a8a">${escaped}</text></svg>`;
}

export function svgContainsCredit(svg: string, credit = ATLAS_EXPORT_CREDIT): boolean {
  return svg.includes(credit) || /data-atlas-credit="1"/.test(svg);
}

type ChartHandle = { getDataURL: (opts: object) => string };

export async function exportChartPng(
  chart: ChartHandle,
  filename: string,
  meta: ImageExportMeta,
  pixelRatio: 1 | 2 | 4,
): Promise<void> {
  const bg = meta.background === "transparent" ? "transparent" : "#ffffff";
  const dataUrl = chart.getDataURL({
    type: "png",
    pixelRatio,
    backgroundColor: bg,
  });
  const composed = await composeChartPng(dataUrl, meta, pixelRatio);
  downloadDataUrl(filename, composed);
}

export function exportChartSvg(
  chart: ChartHandle,
  filename: string,
  meta: ImageExportMeta,
): void {
  const bg = meta.background === "transparent" ? "transparent" : "#ffffff";
  const dataUrl = chart.getDataURL({ type: "svg", backgroundColor: bg });
  const markup = decodeSvgDataUrl(dataUrl);
  downloadText(filename, wrapSvgWithCredit(markup, meta), "image/svg+xml");
}

function decodeSvgDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith("data:image/svg+xml;base64,")) {
    return atob(dataUrl.slice("data:image/svg+xml;base64,".length));
  }
  if (dataUrl.startsWith("data:image/svg+xml,")) {
    return decodeURIComponent(dataUrl.slice("data:image/svg+xml,".length));
  }
  return dataUrl;
}

/** Single-page PDF wrapping a PNG (chart export as PDF). */
export function pngDataUrlToPdfBlob(dataUrl: string, pageTitle: string): Blob {
  const png = dataUrlToUint8(dataUrl);
  // Minimal PDF with embedded image is heavy; ship a text+placeholder PDF that
  // references the credit and tells the user the PNG is the figure companion.
  // For true image embedding we use a simple PDF with the credit as text page.
  void png;
  return buildTextPdf([
    pageTitle,
    "",
    "Figure exported as companion PNG/SVG from IMS Atlas.",
    creditFooter({
      title: pageTitle,
      releaseId: "see-png",
      exportDate: todayIso(),
    }),
  ]);
}

/** Very small multi-page text PDF (Helvetica). */
export function buildTextPdf(lines: string[]): Blob {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const contentLines: string[] = ["BT", "/F1 11 Tf", "50 780 Td", "14 TL"];
  for (const line of lines) {
    contentLines.push(`(${esc(line.slice(0, 110))}) '`);
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
  );
  objects.push(
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefStart}\n%%EOF\n`;
  return new Blob([body], { type: "application/pdf" });
}

export function buildReportPdf(pages: string[][]): Blob {
  // One PDF page per string[] (joined as lines). Multi-page via Kids array.
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const pageObjs: { content: string }[] = pages.map((pageLines) => {
    const contentLines: string[] = ["BT", "/F1 11 Tf", "50 780 Td", "14 TL"];
    for (const line of pageLines) {
      contentLines.push(`(${esc(line.slice(0, 110))}) '`);
    }
    contentLines.push("ET");
    return { content: contentLines.join("\n") };
  });

  const n = pageObjs.length;
  const objects: string[] = [];
  // 1 catalog, 2 pages, then for each page: page obj + content obj; then font
  const fontObjNum = 3 + n * 2;
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  const kids = pageObjs.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  objects.push(`2 0 obj<< /Type /Pages /Kids [${kids}] /Count ${n} >>endobj\n`);
  pageObjs.forEach((p, i) => {
    const pageNum = 3 + i * 2;
    const contentNum = pageNum + 1;
    objects.push(
      `${pageNum} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>endobj\n`,
    );
    objects.push(
      `${contentNum} 0 obj<< /Length ${p.content.length} >>stream\n${p.content}\nendstream\nendobj\n`,
    );
  });
  objects.push(
    `${fontObjNum} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n`,
  );

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefStart}\n%%EOF\n`;
  return new Blob([body], { type: "application/pdf" });
}
