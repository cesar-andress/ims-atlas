/**
 * Project export helpers: .atlas.json and a multi-sheet CSV zip (XLSX stand-in
 * without adding a spreadsheet dependency; Excel opens the CSVs from the zip).
 */

import { serializeAtlasProject, type AtlasProject } from "./projectModel";

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Minimal ZIP (store only) for CSV sheets + README. */
export function buildZip(files: { name: string; body: string }[]): Blob {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = enc.encode(f.body);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    localParts.push(local);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDir = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  const bytes = concat([...localParts, centralDir, end]);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/zip" });
}

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
    "PDF report: Phase X. Chart ZIP: export PNGs from individual views.",
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
