/**
 * Cite-this-analysis helpers (APA / BibTeX / RIS) with placeholders until DOIs exist.
 */

export type CiteInputs = {
  configHash: string;
  origin?: string | undefined;
  hs?: string | undefined;
  year?: number | undefined;
  permalink: string;
  byodVariableIds: string[];
  softwareVersion: string;
};

/** Placeholders — do not invent DOIs (SPEC / research integrity). */
export const SOFTWARE_DOI = "DOI-PENDING-ims-atlas-zenodo";
export const DATA_DOI = "DOI-PENDING-ims-atlas-data-release";
export const TOOL_PAPER_CITE =
  "Baena-Rojas, J. J., & Andrés, C. (n.d.). IMS Atlas: an open tool to build and backtest international market selection indices [Unpublished software paper].";

export function apaCitation(input: CiteInputs): string {
  const scope = [
    input.origin ?? "origin?",
    input.hs ? `HS${input.hs}` : "HS?",
    input.year ?? "year?",
  ].join(" · ");
  const byod =
    input.byodVariableIds.length > 0
      ? ` BYOD variables: ${input.byodVariableIds.join(", ")}.`
      : "";
  return (
    `${TOOL_PAPER_CITE} Analysis config ${scope}; software ${SOFTWARE_DOI} ` +
    `(v${input.softwareVersion}); data ${DATA_DOI}; config hash ${input.configHash}.` +
    byod +
    ` Permalink: ${input.permalink}`
  );
}

export function bibtexCitation(input: CiteInputs): string {
  const byodNote =
    input.byodVariableIds.length > 0
      ? ` BYOD={${input.byodVariableIds.join(", ")}},`
      : "";
  return `@software{ims_atlas_analysis_${input.configHash.slice(0, 8)},
  author = {Baena-Rojas, Jose Jaime and Andrés, César},
  title = {IMS Atlas analysis (${input.origin ?? "?"}, HS${input.hs ?? "?"}, ${input.year ?? "?"})},
  year = {${new Date().getUTCFullYear()}},
  version = {${input.softwareVersion}},
  note = {Software DOI ${SOFTWARE_DOI}; data DOI ${DATA_DOI}; config hash ${input.configHash};${byodNote} tool paper unpublished},
  url = {${input.permalink}}
}`;
}

export function risCitation(input: CiteInputs): string {
  const lines = [
    "TY  - COMP",
    "AU  - Baena-Rojas, Jose Jaime",
    "AU  - Andrés, César",
    `TI  - IMS Atlas analysis (${input.origin ?? "?"}, HS${input.hs ?? "?"}, ${input.year ?? "?"})`,
    `PY  - ${new Date().getUTCFullYear()}`,
    `UR  - ${input.permalink}`,
    `DO  - ${SOFTWARE_DOI}`,
    `N1  - Data DOI ${DATA_DOI}; config hash ${input.configHash}` +
      (input.byodVariableIds.length ? `; BYOD ${input.byodVariableIds.join(",")}` : ""),
    "ER  -",
  ];
  return lines.join("\n");
}

export function pythonReproduceSnippet(input: CiteInputs): string {
  return `# Reproduce with ims-backtest / imsfe (config hash ${input.configHash})
# Software DOI: ${SOFTWARE_DOI}  |  Data DOI: ${DATA_DOI}
from imsfe.run_experiments import score_origin_year
from imsfe.config import load_variables
import pandas as pd

panel = pd.read_parquet("panel_ijt.parquet")  # local / release path
g = panel[(panel.iso3_o == "${input.origin ?? "COL"}") & (panel.year == ${input.year ?? 2023}) & (panel.hs_chapter == "${input.hs ?? "64"}")]
scored = score_origin_year(
    g,
    variables=load_variables(),
    normalization="minmax",
    method="wsm",
    weight_scheme="expert_mean",
)
print(scored.nsmallest(10, "rank"))
`;
}
