/**
 * Phase G coverage grid for project candidates × variables × years.
 * Nothing is filled silently — policies are explicit per variable.
 */

import type { MissingFillPolicy } from "./projectModel";

export type CoverageCellState =
  "available" | "missing" | "imputed" | "outside_release" | "byod_not_loaded";

export type CoverageCell = {
  variableId: string;
  year: number;
  iso3?: string;
  state: CoverageCellState;
  reasonEn: string;
  reasonEs: string;
};

export type CoverageSummary = {
  nVariables: number;
  nWithGaps: number;
  linesEn: string[];
  linesEs: string[];
};

export type CoverageInput = {
  variableIds: string[];
  years: number[];
  candidates: string[];
  /** variableId → year → iso3 → value|null; omit iso for year-only aggregate. */
  values?: Record<string, Record<number, Record<string, number | null>>>;
  /** Variables present in the published release catalog. */
  inRelease: Set<string>;
  /** BYOD variable ids that should be loaded but are not. */
  byodMissing: Set<string>;
  /** Cadence hints (e.g. LPI every 2 years). */
  cadenceYears?: Record<string, number[]>;
  policies?: Record<string, MissingFillPolicy>;
};

export function buildCoverageCells(input: CoverageInput): CoverageCell[] {
  const cells: CoverageCell[] = [];
  for (const variableId of input.variableIds) {
    if (input.byodMissing.has(variableId)) {
      for (const year of input.years) {
        cells.push({
          variableId,
          year,
          state: "byod_not_loaded",
          reasonEn:
            "BYOD variable definition present but values not loaded in this browser.",
          reasonEs:
            "Definición BYOD presente pero los valores no están cargados en este navegador.",
        });
      }
      continue;
    }
    if (!input.inRelease.has(variableId)) {
      for (const year of input.years) {
        cells.push({
          variableId,
          year,
          state: "outside_release",
          reasonEn: "Not in the published redistributable release (licence / gate).",
          reasonEs: "No está en la publicación redistribuible (licencia / gate).",
        });
      }
      continue;
    }
    const cadence = input.cadenceYears?.[variableId];
    for (const year of input.years) {
      if (cadence && cadence.length > 0 && !cadence.includes(year)) {
        cells.push({
          variableId,
          year,
          state: "missing",
          reasonEn: `Not published for ${year} (source cadence).`,
          reasonEs: `No publicado en ${year} (cadencia de la fuente).`,
        });
        continue;
      }
      const byYear = input.values?.[variableId]?.[year];
      if (!byYear) {
        cells.push({
          variableId,
          year,
          state: "missing",
          reasonEn: "No values for this year in the loaded panel.",
          reasonEs: "Sin valores para este año en el panel cargado.",
        });
        continue;
      }
      let available = 0;
      let missing = 0;
      for (const iso of input.candidates) {
        const v = byYear[iso];
        if (v === null || v === undefined || !Number.isFinite(v)) missing += 1;
        else available += 1;
      }
      if (missing === 0) {
        cells.push({
          variableId,
          year,
          state: "available",
          reasonEn: `Available for all ${available} candidates.`,
          reasonEs: `Disponible para los ${available} candidatos.`,
        });
      } else if (available === 0) {
        cells.push({
          variableId,
          year,
          state: "missing",
          reasonEn: "Missing for all candidates in this year.",
          reasonEs: "Falta para todos los candidatos en este año.",
        });
      } else {
        cells.push({
          variableId,
          year,
          state: "missing",
          reasonEn: `${missing} of ${input.candidates.length} candidates missing.`,
          reasonEs: `Faltan ${missing} de ${input.candidates.length} candidatos.`,
        });
      }
    }
  }
  return cells;
}

export function summarizeCoverage(
  cells: readonly CoverageCell[],
  variableIds: readonly string[],
  yearFrom: number,
  yearTo: number,
): CoverageSummary {
  const gapVars = new Set<string>();
  const byVarYears = new Map<string, number[]>();
  for (const c of cells) {
    if (c.state === "available") continue;
    gapVars.add(c.variableId);
    const ys = byVarYears.get(c.variableId) ?? [];
    ys.push(c.year);
    byVarYears.set(c.variableId, ys);
  }
  const linesEn: string[] = [];
  const linesEs: string[] = [];
  for (const id of variableIds) {
    if (!gapVars.has(id)) continue;
    const years = [...new Set(byVarYears.get(id) ?? [])].sort((a, b) => a - b);
    linesEn.push(`${id} (${years.join(", ")} gaps)`);
    linesEs.push(`${id} (${years.join(", ")} sin dato)`);
  }
  return {
    nVariables: variableIds.length,
    nWithGaps: gapVars.size,
    linesEn:
      gapVars.size === 0
        ? [
            `No gaps for ${variableIds.length} variables between ${yearFrom} and ${yearTo}.`,
          ]
        : [
            `${gapVars.size} of ${variableIds.length} variables have gaps between ${yearFrom} and ${yearTo}: ${linesEn.join("; ")}.`,
          ],
    linesEs:
      gapVars.size === 0
        ? [
            `Sin huecos en ${variableIds.length} variables entre ${yearFrom} y ${yearTo}.`,
          ]
        : [
            `${gapVars.size} de ${variableIds.length} variables tienen huecos entre ${yearFrom} y ${yearTo}: ${linesEs.join("; ")}.`,
          ],
  };
}

export const POLICY_LABELS: Record<MissingFillPolicy, { en: string; es: string }> = {
  drop: { en: "Drop variable", es: "Excluir variable" },
  locf: { en: "LOCF (flagged)", es: "LOCF (marcado)" },
  median: { en: "Median (flagged)", es: "Mediana (marcado)" },
  keep: { en: "Keep missing", es: "Dejar missing" },
};
