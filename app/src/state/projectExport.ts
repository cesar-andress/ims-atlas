/**
 * Project export helpers: .atlas.json and a multi-sheet CSV zip (XLSX stand-in
 * without adding a spreadsheet dependency; Excel opens the CSVs from the zip).
 */

import { serializeAtlasProject, type AtlasProject } from "./projectModel";
import { buildZip } from "../export/zip";
import { rowsToCsv } from "../export/xlsx";

export { buildZip };

export function atlasJsonBlob(project: AtlasProject): Blob {
  return new Blob([serializeAtlasProject(project)], {
    type: "application/json",
  });
}

export function projectWorkbookZip(project: AtlasProject): Blob {
  const cfg = project.config;
  const yFrom = project.yearFrom ?? cfg.year;
  const yTo = project.yearTo ?? cfg.year;
  const yearRange =
    yFrom !== undefined && yTo !== undefined
      ? yFrom === yTo
        ? String(yFrom)
        : `${yFrom}-${yTo}`
      : "";

  const readme = [
    "IMS Atlas project export",
    `Name: ${project.name}`,
    `Id: ${project.id}`,
    `Updated: ${project.updatedAt}`,
    `Origin: ${cfg.origin ?? ""}`,
    `HS: ${cfg.hs ?? ""}`,
    `Years: ${yearRange}`,
    `Weight scheme: ${cfg.weightScheme ?? ""}`,
    `Variables: ${(cfg.variableIds ?? []).length}`,
    "",
    "Files are CSV (UTF-8). Re-open the analysis with the .atlas.json file.",
    "PDF report and chart ZIP: use Cite & export (full analysis / PDF report).",
    "Uploaded-data cell values are never embedded in .atlas.json unless explicitly opted in.",
    "© IMS Atlas · atlas.aiserv.es · AISERV SYSTEMS SLU",
  ].join("\n");

  const configRows: string[][] = [
    ["key", "value"],
    ["name", project.name],
    ["id", project.id],
    ["origin", cfg.origin ?? ""],
    ["hs", cfg.hs ?? ""],
    ["year", cfg.year != null ? String(cfg.year) : ""],
    ["yearFrom", yFrom != null ? String(yFrom) : ""],
    ["yearTo", yTo != null ? String(yTo) : ""],
    ["normalization", cfg.normalization ?? ""],
    ["mcdm", cfg.mcdm ?? ""],
    ["weightScheme", cfg.weightScheme ?? ""],
    ["methodFamily", cfg.methodFamily ?? ""],
    ["variables", (cfg.variableIds ?? []).join(";")],
  ];

  const varsRows: string[][] = [
    ["variable_id"],
    ...(cfg.variableIds ?? []).map((id) => [id]),
  ];

  const weightEntries = Object.entries(cfg.factorWeights ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const weightsRows: string[][] = [
    ["factor_id", "weight"],
    ...weightEntries.map(([k, v]) => [k, String(v)]),
  ];

  return buildZip([
    { name: "README.txt", body: `${readme}\n` },
    { name: "config.csv", body: rowsToCsv(configRows) },
    { name: "variables.csv", body: rowsToCsv(varsRows) },
    { name: "weights.csv", body: rowsToCsv(weightsRows) },
  ]);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 80) || "project";
}
