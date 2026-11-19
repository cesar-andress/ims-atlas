/**
 * Strategic matrix IMSFE × EOC (Baena & Cano workbook quadrant names).
 * Authors' English/Spanish labels — do not invent alternate wording.
 */

export const IMSFE_EOC_QUADRANTS = {
  1: {
    en: "GLOBAL LEADERS",
    es: "Líderes globales",
    rule: "high IMSFE + high EOC",
  },
  2: {
    en: "EMERGING OPPORTUNITIES",
    es: "Oportunidades emergentes",
    rule: "low IMSFE + high EOC",
  },
  3: {
    en: "CHALLENGING MARKETS",
    es: "Mercados desafiantes",
    rule: "low IMSFE + low EOC",
  },
  4: {
    en: "NICHE MARKETS",
    es: "Mercados nicho",
    rule: "high IMSFE + low EOC",
  },
} as const;

export type ImsfeEocQuadrant = 1 | 2 | 3 | 4;

export type ImsfeEocPoint = {
  iso3: string;
  imsfe: number;
  eocNorm: number;
  eocRaw: number;
  quadrant: ImsfeEocQuadrant;
  rank: number;
};

export type ImsfeEocMatrixResult = {
  points: ImsfeEocPoint[];
  cutImsfe: number;
  cutEoc: number;
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[mid - 1]! + s[mid]!) / 2;
  return s[mid]!;
}

/** EOC raw = (exports + imports) / GDP; normalised 0–10 vs max in the set. */
export function normalizeEocRatio(
  raw: readonly (number | null)[],
  scaleMax = 10,
): number[] {
  const finite = raw.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const vmax = finite.length ? Math.max(...finite) : Number.NaN;
  if (!Number.isFinite(vmax) || vmax === 0) {
    return raw.map(() => Number.NaN);
  }
  return raw.map((v) =>
    typeof v === "number" && Number.isFinite(v) ? (v / vmax) * scaleMax : Number.NaN,
  );
}

export function eocQuadrantOf(
  imsfe: number,
  eocNorm: number,
  cutImsfe: number,
  cutEoc: number,
): ImsfeEocQuadrant {
  const highI = imsfe >= cutImsfe;
  const highE = eocNorm >= cutEoc;
  if (highI && highE) return 1;
  if (!highI && highE) return 2;
  if (!highI && !highE) return 3;
  return 4;
}

export function buildImsfeEocMatrix(input: {
  rows: { iso3: string; imsfe: number; eocRaw: number; rank: number }[];
  /** median (default) or fixed fraction in [0.3, 0.7] as in the workbook tests. */
  cutoff?: "median" | "fixed";
  fixedCutImsfe?: number;
  fixedCutEoc?: number;
  scaleMax?: number;
}): ImsfeEocMatrixResult {
  const eocNorms = normalizeEocRatio(
    input.rows.map((r) => r.eocRaw),
    input.scaleMax ?? 10,
  );
  const enriched = input.rows.map((r, i) => ({
    iso3: r.iso3,
    imsfe: r.imsfe,
    eocRaw: r.eocRaw,
    eocNorm: eocNorms[i]!,
    rank: r.rank,
  }));

  const cutImsfe =
    input.cutoff === "fixed"
      ? (input.fixedCutImsfe ?? 0.5)
      : median(enriched.map((p) => p.imsfe));
  const cutEoc =
    input.cutoff === "fixed"
      ? (input.fixedCutEoc ?? 0.5)
      : median(enriched.map((p) => p.eocNorm));

  const points: ImsfeEocPoint[] = enriched.map((p) => ({
    ...p,
    quadrant: eocQuadrantOf(p.imsfe, p.eocNorm, cutImsfe, cutEoc),
  }));

  return { points, cutImsfe, cutEoc };
}
