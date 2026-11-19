/**
 * Strategic matrix axes (IMSFE-style attractiveness × fit) from factor scores.
 */

export const IMSFE_ATTRACTIVENESS_FACTORS = [
  "demand",
  "openness_legacy",
  "institutional",
  "macro_risk",
] as const;

export const IMSFE_FIT_FACTORS = [
  "cost_access",
  "logistics",
  "competition",
  "product_fit",
] as const;

export type AxisMode = "median" | "fixed";

export type StrategicPoint = {
  iso3: string;
  attractiveness: number;
  fit: number;
  score: number;
  rank: number;
  quadrant: 1 | 2 | 3 | 4;
};

export type StrategicMatrixResult = {
  points: StrategicPoint[];
  cutAttractiveness: number;
  cutFit: number;
  attractivenessFactors: string[];
  fitFactors: string[];
};

function meanOf(
  factorScores: Record<string, number>,
  factors: readonly string[],
): number {
  const vals: number[] = [];
  for (const f of factors) {
    const v = factorScores[f];
    if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[mid - 1]! + s[mid]!) / 2;
  return s[mid]!;
}

/**
 * Quadrants (Cartesian, cut at cutA / cutF):
 * 1: high A, high F (stars)
 * 2: low A, high F
 * 3: low A, low F
 * 4: high A, low F
 */
export function quadrantOf(
  attractiveness: number,
  fit: number,
  cutA: number,
  cutF: number,
): 1 | 2 | 3 | 4 {
  const highA = attractiveness >= cutA;
  const highF = fit >= cutF;
  if (highA && highF) return 1;
  if (!highA && highF) return 2;
  if (!highA && !highF) return 3;
  return 4;
}

export function buildStrategicMatrix(input: {
  ranking: { iso3: string; score: number; rank: number }[];
  factorScores: Record<string, Record<string, number>>;
  attractivenessFactors?: readonly string[];
  fitFactors?: readonly string[];
  cutoff?: AxisMode;
  fixedAttractiveness?: number;
  fixedFit?: number;
}): StrategicMatrixResult {
  const attrF = [...(input.attractivenessFactors ?? IMSFE_ATTRACTIVENESS_FACTORS)];
  const fitF = [...(input.fitFactors ?? IMSFE_FIT_FACTORS)];

  const raw = input.ranking.map((r) => {
    const fs = input.factorScores[r.iso3] ?? {};
    return {
      iso3: r.iso3,
      attractiveness: meanOf(fs, attrF),
      fit: meanOf(fs, fitF),
      score: r.score,
      rank: r.rank,
    };
  });

  const cutAttractiveness =
    input.cutoff === "fixed"
      ? (input.fixedAttractiveness ?? 0.5)
      : median(raw.map((p) => p.attractiveness));
  const cutFit =
    input.cutoff === "fixed" ? (input.fixedFit ?? 0.5) : median(raw.map((p) => p.fit));

  const points: StrategicPoint[] = raw.map((p) => ({
    ...p,
    quadrant: quadrantOf(p.attractiveness, p.fit, cutAttractiveness, cutFit),
  }));

  return {
    points,
    cutAttractiveness,
    cutFit,
    attractivenessFactors: attrF,
    fitFactors: fitF,
  };
}
