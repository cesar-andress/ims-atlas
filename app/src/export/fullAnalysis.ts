import { version as APP_VERSION } from "@ims-atlas/core";
import { ATLAS_EXPORT_CREDIT } from "./credit";
import { buildReportPdf } from "./imageExport";
import { buildXlsx, readmeSheet, rowsToCsv } from "./xlsx";
import { buildZip } from "./zip";

export type AnalysisExportInput = {
  title: string;
  origin?: string;
  hs?: string;
  year?: number;
  methodPlain: string;
  releaseId: string;
  permalink?: string;
  ranking: { iso3: string; rank: number; score: number }[];
  factorScores?: Record<string, Record<string, number>>;
  coverageNotes?: string[];
  topWhy?: { iso3: string; reason: string }[];
  matrixLines?: string[];
  sources?: string[];
  exportDate?: string;
};

function rankingRows(
  ranking: AnalysisExportInput["ranking"],
  factorScores?: Record<string, Record<string, number>>,
): string[][] {
  const factorKeys = factorScores
    ? [...new Set(Object.values(factorScores).flatMap((m) => Object.keys(m)))].sort()
    : [];
  const header = ["iso3", "rank", "score", ...factorKeys];
  const rows = [header];
  for (const r of ranking) {
    rows.push([
      r.iso3,
      String(r.rank),
      String(r.score),
      ...factorKeys.map((f) => String(factorScores?.[r.iso3]?.[f] ?? "")),
    ]);
  }
  return rows;
}

/** Full analysis XLSX (all tables) for "Exportar análisis completo". */
export function buildFullAnalysisXlsx(input: AnalysisExportInput): Blob {
  const date = input.exportDate ?? new Date().toISOString().slice(0, 10);
  const leeme = readmeSheet({
    title: input.title,
    ...(input.permalink ? { permalink: input.permalink } : {}),
    appVersion: APP_VERSION,
    releaseId: input.releaseId,
    exportDate: date,
    methodPlain: input.methodPlain,
    sources: input.sources ?? [],
    qualityNotes: input.coverageNotes ?? [],
  });
  const sheets = [
    leeme,
    { name: "ranking", rows: rankingRows(input.ranking, input.factorScores) },
    {
      name: "top_why",
      rows: [
        ["iso3", "reason"],
        ...(input.topWhy ?? []).map((r) => [r.iso3, r.reason]),
      ],
    },
    {
      name: "matrix",
      rows: [["note"], ...(input.matrixLines ?? []).map((l) => [l])],
    },
  ];
  return buildXlsx(sheets);
}

/** ZIP of CSV tables + README (charts added by caller as PNG/SVG bytes). */
export function buildFullAnalysisZip(
  input: AnalysisExportInput,
  chartFiles: { name: string; body: string | Uint8Array }[] = [],
): Blob {
  const date = input.exportDate ?? new Date().toISOString().slice(0, 10);
  const readme = [
    input.title,
    `origin=${input.origin ?? ""} hs=${input.hs ?? ""} year=${input.year ?? ""}`,
    `method: ${input.methodPlain}`,
    `app ${APP_VERSION} · data release ${input.releaseId} · ${date}`,
    ATLAS_EXPORT_CREDIT,
  ].join("\n");
  return buildZip([
    { name: "README.txt", body: `${readme}\n` },
    {
      name: "ranking.csv",
      body: rowsToCsv(rankingRows(input.ranking, input.factorScores)),
    },
    ...chartFiles,
  ]);
}

/** 4–8 page PDF report. */
export function buildAnalysisReportPdf(input: AnalysisExportInput): Blob {
  const date = input.exportDate ?? new Date().toISOString().slice(0, 10);
  const top = input.ranking.slice(0, 10);
  const pages: string[][] = [
    [
      "IMS Atlas analysis report",
      input.title,
      `Origin ${input.origin ?? "-"}, HS ${input.hs ?? "-"}, year ${input.year ?? "-"}`,
      `Method: ${input.methodPlain}`,
      `Data version ${input.releaseId}, app ${APP_VERSION}, ${date}`,
      ATLAS_EXPORT_CREDIT,
    ],
    [
      "Top markets",
      ...top.map(
        (r) =>
          `${r.rank}. ${r.iso3}  score=${r.score.toFixed(4)}${
            input.topWhy?.find((w) => w.iso3 === r.iso3)
              ? `: ${input.topWhy.find((w) => w.iso3 === r.iso3)!.reason}`
              : ""
          }`,
      ),
    ],
    [
      "Strategic matrix / strategies",
      ...(input.matrixLines?.length
        ? input.matrixLines
        : ["Open the Matrix view for quadrant strategies."]),
    ],
    [
      "Map",
      "Export the Market map PNG/SVG from /map for the figure.",
      "Basemap attribution is preserved on map exports.",
    ],
    [
      "Method",
      input.methodPlain,
      "Time-t features use only data with year ≤ t.",
      "Missing cells are never silently filled.",
    ],
    ["Sources", ...(input.sources?.length ? input.sources : ["See /data/sources"])],
    [
      "Coverage / data quality",
      ...(input.coverageNotes?.length
        ? input.coverageNotes
        : ["See project coverage check for gaps."]),
      "",
      ATLAS_EXPORT_CREDIT,
    ],
  ];
  return buildReportPdf(pages);
}

/** IMSFE-shaped workbook layout (Phase J tables as sheets). */
export function buildImsfeWorkbookXlsx(input: AnalysisExportInput): Blob {
  const date = input.exportDate ?? new Date().toISOString().slice(0, 10);
  return buildXlsx([
    readmeSheet({
      title: `IMSFE book: ${input.title}`,
      appVersion: APP_VERSION,
      releaseId: input.releaseId,
      exportDate: date,
      methodPlain: "IMSFE Baena & Cano layout export",
      sources: input.sources ?? [],
    }),
    { name: "Preselection", rows: [["iso3"], ...input.ranking.map((r) => [r.iso3])] },
    { name: "Scores", rows: rankingRows(input.ranking, input.factorScores) },
    {
      name: "Standardization",
      rows: [
        ["note"],
        ["See Norm lab / docs why-normalize for transform pipeline."],
        ["Tablas discrepancy: docs/imsfe-tablas-discrepancy.md"],
      ],
    },
  ]);
}
