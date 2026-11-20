import type { ImsfeEocMatrixResult, StrategicMatrixResult } from "@ims-atlas/core";

/** Map IMSFE×EOC points onto the StrategicScatter shape (y=IMSFE, x=EOC). */
export function eocToStrategicMatrix(eoc: ImsfeEocMatrixResult): StrategicMatrixResult {
  return {
    cutAttractiveness: eoc.cutImsfe,
    cutFit: eoc.cutEoc,
    attractivenessFactors: ["IMSFE"],
    fitFactors: ["EOC"],
    points: eoc.points.map((p) => ({
      iso3: p.iso3,
      attractiveness: p.imsfe,
      fit: p.eocNorm,
      score: p.imsfe,
      rank: p.rank,
      quadrant: p.quadrant,
    })),
  };
}
