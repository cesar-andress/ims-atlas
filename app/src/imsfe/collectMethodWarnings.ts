import {
  warnAggregatedRespondents,
  warnDiscontinuedSeries,
  warnEocDefinition,
  warnWeightsRenormalised,
  type MethodWarning,
} from "@ims-atlas/core";
import type { AnalysisConfig } from "../state/schema";

/** Baseline method warnings for the results "Calidad de datos" card. */
export function collectMethodWarnings(config: AnalysisConfig): MethodWarning[] {
  const out: MethodWarning[] = [];

  if (config.methodFamily === "imsfem_2025_olive") {
    const w = warnAggregatedRespondents(1, 14);
    if (w) out.push(w);
  }

  out.push(warnDiscontinuedSeries("CIBC", 2019));

  if ((config.culturalDistanceKind ?? "sum_of_sums") === "sum_of_sums") {
    out.push({
      code: "culture_default_workbook",
      severity: "info",
      message: {
        es: "Distancia cultural: diferencia de sumas (reproducción del libro). Compare con suma de |dimensiones| o Kogut–Singh en Opciones avanzadas.",
        en: "Cultural distance: difference of sums (workbook reproduction). Compare with sum of |dimensions| or Kogut–Singh under Advanced options.",
      },
    });
  }

  out.push(
    warnEocDefinition({
      tradeUnit: "usd",
      gdpUnit: "usd",
      definition: "goods_services",
    }),
  );

  // Visible note when user has not unit-normalised expert weights elsewhere
  const fw = config.factorWeights;
  if (fw) {
    const sum = Object.values(fw).reduce((a, b) => a + (b ?? 0), 0);
    const w = warnWeightsRenormalised(sum, "criteria");
    if (w) out.push(w);
  }

  return out;
}
