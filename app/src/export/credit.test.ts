import { describe, expect, it } from "vitest";
import { ATLAS_EXPORT_CREDIT } from "./credit";
import {
  injectPngTextChunk,
  pngBytesContainCredit,
  svgContainsCredit,
  wrapSvgWithCredit,
} from "./imageExport";
import { mayExportCell } from "./licenceGate";
import { buildXlsx, readmeSheet, rowsToCsv } from "./xlsx";
import { buildAnalysisReportPdf, buildFullAnalysisXlsx } from "./fullAnalysis";

/** Minimal valid 1×1 PNG (white pixel). */
function tinyPng(): Uint8Array {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

describe("Phase X export credit + licence", () => {
  it("credit constant matches PROMPTS wording", () => {
    expect(ATLAS_EXPORT_CREDIT).toBe(
      "© IMS Atlas · atlas.aiserv.es · AISERV SYSTEMS SLU",
    );
  });

  it("PNG tEXt chunk carries the credit", () => {
    const withCredit = injectPngTextChunk(tinyPng(), "Copyright", ATLAS_EXPORT_CREDIT);
    expect(pngBytesContainCredit(withCredit)).toBe(true);
  });

  it("SVG wrapper embeds credit text", () => {
    const svg = wrapSvgWithCredit(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>`,
      {
        title: "Test",
        releaseId: "1.1.0",
        exportDate: "2026-01-01",
      },
    );
    expect(svgContainsCredit(svg)).toBe(true);
    expect(svg).toContain(ATLAS_EXPORT_CREDIT);
  });

  it("licence gate: ship_derived blocks raw, allows derived", () => {
    expect(mayExportCell("ship_derived", "raw")).toBe(false);
    expect(mayExportCell("ship_derived", "derived")).toBe(true);
    expect(mayExportCell("local_only", "derived")).toBe(false);
    expect(mayExportCell("byod_only", "byod")).toBe(true);
    expect(mayExportCell("byod_only", "raw")).toBe(false);
    expect(mayExportCell("ship_raw", "raw")).toBe(true);
  });

  it("XLSX LEEME sheet includes credit", async () => {
    const blob = buildXlsx([
      readmeSheet({
        title: "t",
        appVersion: "1.1.0",
        releaseId: "1.1.0",
        exportDate: "2026-01-01",
      }),
      { name: "data", rows: [["a"], ["1"]] },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder().decode(buf);
    expect(text).toContain("LEEME");
    expect(text).toContain(ATLAS_EXPORT_CREDIT);
  });

  it("CSV helper is deterministic", () => {
    expect(
      rowsToCsv([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toBe("a,b\n1,2\n");
  });

  it("full analysis PDF and XLSX include credit", async () => {
    const input = {
      title: "COL HS64",
      origin: "COL",
      hs: "64",
      year: 2023,
      methodPlain: "minmax / topsis",
      releaseId: "1.1.0",
      ranking: [{ iso3: "USA", rank: 1, score: 0.9 }],
      exportDate: "2026-01-01",
    };
    const pdf = buildAnalysisReportPdf(input);
    const pdfText = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(pdfText).toContain(ATLAS_EXPORT_CREDIT);

    const xlsx = buildFullAnalysisXlsx(input);
    const xText = new TextDecoder().decode(await xlsx.arrayBuffer());
    expect(xText).toContain(ATLAS_EXPORT_CREDIT);
  });
});
