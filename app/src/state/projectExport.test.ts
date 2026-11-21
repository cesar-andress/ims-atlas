import { describe, expect, it } from "vitest";
import { createEmptyProject } from "./projectModel";
import { atlasJsonBlob, projectWorkbookZip, safeFilename } from "./projectExport";
import { importAtlasProjectJson, prepareImportedProject } from "./projectStore";
import { rankingToCsv } from "../cite/exportDownload";

async function zipNames(blob: Blob): Promise<string[]> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder().decode(buf);
  const names: string[] = [];
  // Stored ZIP local headers carry the filename after a fixed 30-byte prefix.
  let i = 0;
  while (i + 30 < buf.length) {
    if (
      buf[i] === 0x50 &&
      buf[i + 1] === 0x4b &&
      buf[i + 2] === 0x03 &&
      buf[i + 3] === 0x04
    ) {
      const nameLen = buf[i + 26]! | (buf[i + 27]! << 8);
      const extraLen = buf[i + 28]! | (buf[i + 29]! << 8);
      const start = i + 30;
      const name = new TextDecoder().decode(buf.slice(start, start + nameLen));
      names.push(name);
      const compSize =
        buf[i + 18]! |
        (buf[i + 19]! << 8) |
        (buf[i + 20]! << 16) |
        (buf[i + 21]! << 24);
      i = start + nameLen + extraLen + compSize;
      continue;
    }
    i += 1;
  }
  void text;
  return names;
}

describe("project export / import audit", () => {
  it("safeFilename strips unsafe characters", () => {
    expect(safeFilename("ESP · café / 2024")).toBe("ESP_caf_2024");
  });

  it("atlas.json round-trips and import remints id", async () => {
    const original = createEmptyProject({
      name: "Café ESP",
      config: {
        v: 1,
        view: "analisis",
        origin: "ESP",
        hs: "09",
        year: 2024,
        variableIds: ["gdp", "dist"],
        factorWeights: { demand: 0.4, logistics: 0.6 },
      },
      yearFrom: 2024,
      yearTo: 2024,
    });
    const blob = atlasJsonBlob(original);
    const text = await blob.text();
    const parsed = importAtlasProjectJson(text);
    expect(parsed.id).toBe(original.id);
    expect(parsed.name).toBe("Café ESP");

    const copy = prepareImportedProject(parsed, "importado");
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe("Café ESP (importado)");
    expect(copy.includeByodValues).toBe(false);
  });

  it("workbook zip includes config, variables and weights CSV", async () => {
    const project = createEmptyProject({
      name: 'A,B "quoted"',
      config: {
        v: 1,
        view: "analisis",
        origin: "COL",
        hs: "64",
        year: 2023,
        variableIds: ["v1", "v2"],
        factorWeights: { demand: 0.5, cost_access: 0.5 },
      },
    });
    const names = await zipNames(projectWorkbookZip(project));
    expect(names).toEqual(
      expect.arrayContaining([
        "README.txt",
        "config.csv",
        "variables.csv",
        "weights.csv",
      ]),
    );
  });

  it("rankingToCsv escapes commas and quotes", () => {
    const csv = rankingToCsv([{ iso3: "C,O", rank: 1, score: 9.5 }], {
      "C,O": { "cost,access": 1.2 },
    });
    expect(csv).toContain('"C,O"');
    expect(csv).toContain('"cost,access"');
    expect(csv.split("\n")[0]).toMatch(/^iso3,rank,score,/);
  });
});
