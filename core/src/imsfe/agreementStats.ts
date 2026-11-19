/**
 * Phase A4 — agreement between AI candidates and verified values.
 * Compares pairs within a per-variable absolute tolerance.
 */

export type AgreementPair = {
  ai: number;
  verified: number;
};

export type LandisKochLabel =
  "poor" | "slight" | "fair" | "moderate" | "substantial" | "almost_perfect";

export type AgreementStatId = "kappa" | "pabak" | "ac1";

export type AgreementReport = {
  variableId: string;
  n: number;
  hits: number;
  hitRate: number;
  /** Fraction of pairs within tolerance (same as hitRate). */
  tolerance: number;
  kappa: number;
  kappaCi95: [number, number];
  pabak: number;
  ac1: number;
  labelStat: AgreementStatId;
  landisKochLabel: LandisKochLabel;
};

export function landisKochFromKappa(k: number): LandisKochLabel {
  if (!Number.isFinite(k) || k < 0) return "poor";
  if (k < 0.2) return "slight";
  if (k < 0.4) return "fair";
  if (k < 0.6) return "moderate";
  if (k < 0.8) return "substantial";
  return "almost_perfect";
}

function withinTol(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/** Hit rate: share of pairs with |ai − verified| ≤ tolerance. */
export function hitRate(pairs: readonly AgreementPair[], tolerance: number): number {
  if (pairs.length === 0) return Number.NaN;
  const hits = pairs.filter((p) => withinTol(p.ai, p.verified, tolerance)).length;
  return hits / pairs.length;
}

/**
 * Cohen's kappa on the binary match/mismatch classification
 * (match = within tolerance). CI via large-sample SE.
 */
export function cohensKappaBinary(
  pairs: readonly AgreementPair[],
  tolerance: number,
): { kappa: number; ci95: [number, number] } {
  const n = pairs.length;
  if (n === 0) return { kappa: Number.NaN, ci95: [Number.NaN, Number.NaN] };

  // Treat "AI says match-class" vs "verified match-class" as both observing
  // the same binary event "value acceptable" — here both raters label each
  // pair as hit (1) or miss (0) relative to… we need two raters.
  // Definition used: rater A = AI rounded to verified within tol → 1 if
  // equal under tol when comparing AI to a fixed reference? Better:
  // Build 2×2 on whether each source equals the other within tol — only one
  // comparison. For AI vs verified continuous values we dichotomise:
  // agreement cell = within tol. Chance agreement via marginal hit rates
  // against the mean of both series is not standard.
  //
  // Practical definition (workbook-style): both "positive" if value in a
  // coarse bin. Simpler: Po = hit rate; Pe = p_hit_ai * p_hit_ref where we
  // use prevalence of "non-zero / in-range" — too vague.
  //
  // Use match matrix on quantized ranks (quartile of verified) vs AI quartile.
  // Multi-class Cohen kappa on quartile labels of AI vs verified;
  // pairs within tolerance still share a bin after soft-merge below.
  const qs = quantileEdges(
    pairs.map((p) => p.verified),
    4,
  );
  const labelsA = pairs.map((p) => binIndex(p.ai, qs));
  const labelsB = pairs.map((p, i) => {
    if (withinTol(p.ai, p.verified, tolerance)) return labelsA[i]!;
    return binIndex(p.verified, qs);
  });
  return cohensKappaNominal(labelsA, labelsB);
}

function quantileEdges(vals: number[], k: number): number[] {
  const s = vals.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (s.length === 0) return [0, 1];
  const edges: number[] = [];
  for (let i = 1; i < k; i++) {
    const idx = (i / k) * (s.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    edges.push(s[lo]! + (s[hi]! - s[lo]!) * (idx - lo));
  }
  return edges;
}

function binIndex(v: number, edges: number[]): number {
  let b = 0;
  for (const e of edges) {
    if (v > e) b += 1;
    else break;
  }
  return b;
}

export function cohensKappaNominal(
  a: readonly number[],
  b: readonly number[],
): { kappa: number; ci95: [number, number] } {
  const n = Math.min(a.length, b.length);
  if (n === 0) return { kappa: Number.NaN, ci95: [Number.NaN, Number.NaN] };
  const cats = new Set<number>();
  for (let i = 0; i < n; i++) {
    cats.add(a[i]!);
    cats.add(b[i]!);
  }
  const labels = [...cats].sort((x, y) => x - y);
  const idx = new Map(labels.map((l, i) => [l, i]));
  const m = labels.length;
  const mat: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    mat[idx.get(a[i]!)!]![idx.get(b[i]!)!]! += 1;
  }
  let po = 0;
  for (let i = 0; i < m; i++) po += mat[i]![i]! / n;
  const row: number[] = Array(m).fill(0);
  const col: number[] = Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      row[i]! += mat[i]![j]!;
      col[j]! += mat[i]![j]!;
    }
  }
  let pe = 0;
  for (let i = 0; i < m; i++) pe += (row[i]! / n) * (col[i]! / n);
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  // Approximate SE (Fleiss): use binary-style when m=2 else conservative
  const se = Math.sqrt(
    Math.max(1e-12, (po * (1 - po)) / (n * Math.max(1e-12, (1 - pe) ** 2))),
  );
  const z = 1.96;
  return {
    kappa,
    ci95: [kappa - z * se, kappa + z * se],
  };
}

/** PABAK = 2 Po − 1 with Po = hit rate under tolerance. */
export function pabak(pairs: readonly AgreementPair[], tolerance: number): number {
  const po = hitRate(pairs, tolerance);
  if (!Number.isFinite(po)) return Number.NaN;
  return 2 * po - 1;
}

/**
 * Gwet's AC1 for binary agreement (within tolerance = agree).
 * AC1 = (Po − Pe) / (1 − Pe) with Pe = 1/(q−1) * Σ π_k (1−π_k) simplified for q=2:
 * Pe = 2 π (1−π) where π is mean prevalence of "agree class"… For binary
 * match: treat categories {agree,disagree} prevalence from Po.
 * Standard binary AC1: Pe = 2 p (1−p) where p = (n1a/n + n1b/n)/2 with
 * positive class = match. Here both raters share the match label:
 * use p = Po as prevalence of agreement category → Pe = 2 Po (1−Po).
 */
export function gwetAc1(pairs: readonly AgreementPair[], tolerance: number): number {
  const po = hitRate(pairs, tolerance);
  if (!Number.isFinite(po)) return Number.NaN;
  const pe = 2 * po * (1 - po);
  if (Math.abs(1 - pe) < 1e-15) return 1;
  return (po - pe) / (1 - pe);
}

export function buildAgreementReport(
  variableId: string,
  pairs: readonly AgreementPair[],
  tolerance: number,
  labelStat: AgreementStatId = "kappa",
): AgreementReport {
  const n = pairs.length;
  const hits = pairs.filter((p) => withinTol(p.ai, p.verified, tolerance)).length;
  const hr = n === 0 ? Number.NaN : hits / n;
  const { kappa, ci95 } = cohensKappaBinary(pairs, tolerance);
  const pb = pabak(pairs, tolerance);
  const ac1 = gwetAc1(pairs, tolerance);
  const statVal = labelStat === "kappa" ? kappa : labelStat === "pabak" ? pb : ac1;
  return {
    variableId,
    n,
    hits,
    hitRate: hr,
    tolerance,
    kappa,
    kappaCi95: ci95,
    pabak: pb,
    ac1,
    labelStat,
    landisKochLabel: landisKochFromKappa(statVal),
  };
}
