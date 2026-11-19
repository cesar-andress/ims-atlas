/**
 * Project export helpers: .atlas.json and a multi-sheet CSV zip (XLSX stand-in
 * without adding a spreadsheet dependency; Excel opens the CSVs from the zip).
 */

import { serializeAtlasProject, type AtlasProject } from "./projectModel";
import { buildZip } from "../export/zip";

export { buildZip };

export function atlasJsonBlob(project: AtlasProject): Blob {
  return new Blob([serializeAtlasProject(project)], {
    type: "application/json",
  });
}

export function projectWorkbookZip(project: AtlasProject): Blob {
  const cfg = project.config;
  const readme = [
    "IMS Atlas project export",
    `Name: ${project.name}`,
    `Id: ${project.id}`,
    `Updated: ${project.updatedAt}`,
    `Origin: ${cfg.origin ?? ""}`,
    `HS: ${cfg.hs ?? ""}`,
    `Years: ${project.yearFrom ?? cfg.year ?? ""}–${project.yearTo ?? cfg.year ?? ""}`,
    "",
    "Sheets are CSV (UTF-8). Re-open the analysis with the .atlas.json file.",
    "PDF report and chart ZIP: use Cite & export (full analysis / PDF report).",
    "© IMS Atlas · atlas.aiserv.es · AISERV SYSTEMS SLU",
  ].join("\n");

  const configCsv = [
    "key,value",
    `name,${JSON.stringify(project.name)}`,
    `origin,${cfg.origin ?? ""}`,
    `hs,${cfg.hs ?? ""}`,
    `year,${cfg.year ?? ""}`,
    `normalization,${cfg.normalization ?? ""}`,
    `mcdm,${cfg.mcdm ?? ""}`,
    `weightScheme,${cfg.weightScheme ?? ""}`,
    `variables,"${(cfg.variableIds ?? []).join(";")}"`,
  ].join("\n");

  const varsCsv = ["variable_id", ...(cfg.variableIds ?? [])].join("\n");

  return buildZip([
    { name: "README.txt", body: `${readme}\n` },
    { name: "config.csv", body: `${configCsv}\n` },
    { name: "variables.csv", body: `${varsCsv}\n` },
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
