/**
 * Phase A8 — side-by-side project / version comparison.
 */

export type ProjectSnapshot = {
  id: string;
  label: string;
  origin?: string;
  hs?: string;
  nCriteria: number;
  criterionWeights: Record<string, number>;
  variableIds: string[];
  topMarkets: string[];
  quadrantCounts?: Record<string, number>;
  methodNotes: string[];
  /** iso3 → score for rank diffs */
  scores: Record<string, number>;
  /** iso3 → raw variable values for value diffs */
  values?: Record<string, Record<string, number>>;
};

export type RankChange = {
  iso3: string;
  rankA: number | null;
  rankB: number | null;
  delta: number | null;
};

export type ValueChange = {
  iso3: string;
  variableId: string;
  a: number | null;
  b: number | null;
  absDelta: number | null;
};

export type ProjectCompareResult = {
  projects: ProjectSnapshot[];
  weightDiffs: { criterion: string; weights: Record<string, number> }[];
  methodDiffNotes: string[];
  rankChanges: RankChange[];
  valueChanges: ValueChange[];
};

function ranksOf(scores: Record<string, number>): Record<string, number> {
  const sorted = Object.entries(scores)
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => b[1]! - a[1]! || a[0].localeCompare(b[0]));
  const out: Record<string, number> = {};
  sorted.forEach(([k], i) => {
    out[k] = i + 1;
  });
  return out;
}

export function compareProjects(
  projects: readonly ProjectSnapshot[],
): ProjectCompareResult {
  if (projects.length < 2) {
    return {
      projects: [...projects],
      weightDiffs: [],
      methodDiffNotes: ["need at least two projects"],
      rankChanges: [],
      valueChanges: [],
    };
  }
  const a = projects[0]!;
  const b = projects[1]!;
  const crits = new Set([
    ...Object.keys(a.criterionWeights),
    ...Object.keys(b.criterionWeights),
  ]);
  const weightDiffs = [...crits].sort().map((criterion) => ({
    criterion,
    weights: Object.fromEntries(
      projects.map((p) => [p.id, p.criterionWeights[criterion] ?? 0]),
    ),
  }));

  const methodDiffNotes: string[] = [];
  if (a.nCriteria !== b.nCriteria) {
    methodDiffNotes.push(
      `${a.label} has ${a.nCriteria} criteria; ${b.label} has ${b.nCriteria}`,
    );
  }
  const onlyA = a.variableIds.filter((v) => !b.variableIds.includes(v));
  const onlyB = b.variableIds.filter((v) => !a.variableIds.includes(v));
  if (onlyA.length) {
    methodDiffNotes.push(`Variables only in ${a.label}: ${onlyA.join(", ")}`);
  }
  if (onlyB.length) {
    methodDiffNotes.push(`Variables only in ${b.label}: ${onlyB.join(", ")}`);
  }
  for (const note of [...a.methodNotes, ...b.methodNotes]) {
    if (!methodDiffNotes.includes(note)) methodDiffNotes.push(note);
  }

  const ra = ranksOf(a.scores);
  const rb = ranksOf(b.scores);
  const isos = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  const rankChanges: RankChange[] = [...isos].sort().map((iso3) => {
    const rankA = ra[iso3] ?? null;
    const rankB = rb[iso3] ?? null;
    return {
      iso3,
      rankA,
      rankB,
      delta: rankA !== null && rankB !== null ? rankA - rankB : null,
    };
  });

  const valueChanges: ValueChange[] = [];
  if (a.values && b.values) {
    const vars = new Set([...Object.keys(a.values), ...Object.keys(b.values)]);
    for (const variableId of vars) {
      const va = a.values[variableId] ?? {};
      const vb = b.values[variableId] ?? {};
      const countries = new Set([...Object.keys(va), ...Object.keys(vb)]);
      for (const iso3 of countries) {
        const x = va[iso3] ?? null;
        const y = vb[iso3] ?? null;
        if (x === y) continue;
        valueChanges.push({
          iso3,
          variableId,
          a: x,
          b: y,
          absDelta: x !== null && y !== null ? Math.abs(x - y) : null,
        });
      }
    }
  }

  return {
    projects: [...projects],
    weightDiffs,
    methodDiffNotes,
    rankChanges,
    valueChanges,
  };
}

/** Build a simple multi-sheet-friendly table payload for XLSX export. */
export function compareExportTables(result: ProjectCompareResult): {
  readme: string[][];
  ranks: string[][];
  weights: string[][];
  values: string[][];
} {
  const ids = result.projects.map((p) => p.id);
  const readme = [
    ["IMS Atlas project comparison"],
    ["projects", result.projects.map((p) => p.label).join(" | ")],
    ...result.methodDiffNotes.map((n) => ["note", n]),
  ];
  const ranks = [
    ["iso3", ...ids.map((id) => `rank_${id}`), "delta_0_1"],
    ...result.rankChanges.map((r) => [
      r.iso3,
      ...result.projects.map((p) => {
        const scores = p.scores;
        const ranked = ranksOf(scores);
        return String(ranked[r.iso3] ?? "");
      }),
      r.delta === null ? "" : String(r.delta),
    ]),
  ];
  const weights = [
    ["criterion", ...ids],
    ...result.weightDiffs.map((w) => [
      w.criterion,
      ...ids.map((id) => String(w.weights[id] ?? "")),
    ]),
  ];
  const values = [
    ["iso3", "variable", ...ids, "abs_delta"],
    ...result.valueChanges.map((v) => [
      v.iso3,
      v.variableId,
      ...result.projects.map((p) => {
        const val = p.values?.[v.variableId]?.[v.iso3];
        return val === undefined ? "" : String(val);
      }),
      v.absDelta === null ? "" : String(v.absDelta),
    ]),
  ];
  return { readme, ranks, weights, values };
}
