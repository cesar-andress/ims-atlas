import { ATLAS_EXPORT_CREDIT } from "./credit";
import { buildZip } from "./zip";

export type Sheet = { name: string; rows: string[][] };

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function sheetXml(rows: string[][]): string {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`,
  ];
  rows.forEach((row, r) => {
    lines.push(`<row r="${r + 1}">`);
    row.forEach((cell, c) => {
      const ref = `${colName(c)}${r + 1}`;
      lines.push(`<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`);
    });
    lines.push(`</row>`);
  });
  lines.push(`</sheetData></worksheet>`);
  return lines.join("");
}

/** Minimal XLSX (Office Open XML) with a LEEME/README sheet first. */
export function buildXlsx(sheets: Sheet[]): Blob {
  const safe = sheets.map((s, i) => ({
    name: (s.name || `Sheet${i + 1}`).slice(0, 31),
    rows: s.rows,
  }));
  const workbookSheets = safe
    .map(
      (s, i) =>
        `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("");
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${workbookSheets}</sheets>
</workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${safe
  .map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  )
  .join("\n")}
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${safe
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join("\n")}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const files = [
    { name: "[Content_Types].xml", body: contentTypes },
    { name: "_rels/.rels", body: rootRels },
    { name: "xl/workbook.xml", body: workbook },
    { name: "xl/_rels/workbook.xml.rels", body: rels },
    ...safe.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      body: sheetXml(s.rows),
    })),
  ];
  return buildZip(files);
}

export function readmeSheet(meta: {
  title: string;
  permalink?: string;
  appVersion: string;
  releaseId: string;
  exportDate: string;
  methodPlain?: string;
  sources?: string[];
  qualityNotes?: string[];
}): Sheet {
  const rows: string[][] = [
    ["LEEME / README"],
    ["title", meta.title],
    ["permalink", meta.permalink ?? ""],
    ["app_version", meta.appVersion],
    ["data_release", meta.releaseId],
    ["export_date", meta.exportDate],
    ["method", meta.methodPlain ?? ""],
    ["credit", ATLAS_EXPORT_CREDIT],
    [],
    ["sources"],
    ...(meta.sources ?? []).map((s) => [s]),
    [],
    ["data_quality"],
    ...(meta.qualityNotes ?? []).map((s) => [s]),
  ];
  return { name: "LEEME", rows };
}

export function rowsToCsv(rows: string[][]): string {
  return (
    rows
      .map((r) =>
        r
          .map((c) => {
            if (/[",\n]/.test(c)) return `"${c.replace(/"/g, '""')}"`;
            return c;
          })
          .join(","),
      )
      .join("\n") + "\n"
  );
}
