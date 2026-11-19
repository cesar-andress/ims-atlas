import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { score as scoreMcdm } from "./mcdm.js";
import { prepareBlock } from "./missing.js";
import { normalizeMatrix } from "./normalize.js";
import type {
  Direction,
  HierarchicalWeights,
  McdmId,
  NormalizationId,
  VariableSpec,
  WeightSchemeId,
} from "./types.js";
import { flatWeights, getWeights, restrictWeights } from "./weights.js";

type Golden = {
  tolerance: number;
  variables: VariableSpec[];
  blocks: {
    id: string;
    candidates: string[];
    columns: string[];
    directions: Record<string, Direction>;
    raw: (number | null)[][];
    prepared: {
      used_variables: string[];
      excluded_variables: string[];
      matrix: number[][];
      n_imputed_cells: number;
      imputed_mask: boolean[][];
    };
    normalized: Record<string, number[][]>;
    weights: Record<
      string,
      {
        factors: Record<string, number>;
        variables_within: Record<string, Record<string, number>>;
        flat: Record<string, number>;
      }
    >;
    scores: Record<string, number[]>;
  }[];
};

const TOL = 1e-9;

function loadGolden(): Golden {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "fixtures", "phase5", "golden.json");
  return JSON.parse(readFileSync(path, "utf8")) as Golden;
}

function expectCloseArrays(actual: number[], expected: number[], label: string) {
  expect(actual.length, label).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i]!;
    const e = expected[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(e)) {
      expect(Number.isFinite(a), `${label}[${i}] finite`).toBe(Number.isFinite(e));
      continue;
    }
    const diff = Math.abs(a - e);
    if (diff > TOL) {
      throw new Error(`${label}[${i}]: |${a} - ${e}| = ${diff} > ${TOL}`);
    }
  }
}

function expectCloseRecords(
  actual: Record<string, number>,
  expected: Record<string, number>,
  label: string,
) {
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
  for (const k of keys) {
    const a = actual[k] ?? 0;
    const e = expected[k] ?? 0;
    const diff = Math.abs(a - e);
    if (diff > TOL) {
      throw new Error(`${label}.${k}: |${a} - ${e}| = ${diff} > ${TOL}`);
    }
  }
}

const golden = loadGolden();

describe("phase5 golden vs ims-backtest", () => {
  it("has 10 origin-year blocks", () => {
    expect(golden.blocks.length).toBe(10);
  });

  for (const block of golden.blocks) {
    describe(block.id, () => {
      it("prepareBlock matches", () => {
        const prep = prepareBlock({
          candidates: block.candidates,
          columns: block.columns,
          values: block.raw,
          policy: { maxMissingShare: 0.2, minCandidates: 20 },
        });
        expect(prep.usedVariables).toEqual(block.prepared.used_variables);
        expect(prep.excludedVariables).toEqual(block.prepared.excluded_variables);
        expect(prep.nImputedCells).toBe(block.prepared.n_imputed_cells);
        expectCloseArrays(
          prep.matrix.flat(),
          block.prepared.matrix.flat(),
          `${block.id} matrix`,
        );
        expect(prep.imputedMask).toEqual(block.prepared.imputed_mask);
      });

      for (const method of Object.keys(block.normalized) as NormalizationId[]) {
        it(`normalize ${method}`, () => {
          const used = block.prepared.used_variables;
          const dirs: Record<string, Direction> = {};
          for (const c of used) dirs[c] = block.directions[c]!;
          const got = normalizeMatrix(block.prepared.matrix, used, dirs, method);
          expectCloseArrays(
            got.flat(),
            block.normalized[method]!.flat(),
            `${block.id} norm ${method}`,
          );
        });
      }

      for (const scheme of Object.keys(block.weights) as WeightSchemeId[]) {
        it(`weights ${scheme}`, () => {
          const used = block.prepared.used_variables;
          const vars = golden.variables.filter((v) => used.includes(v.id));
          const dirs: Record<string, Direction> = {};
          for (const c of used) dirs[c] = block.directions[c]!;
          const w = getWeights(scheme, vars, {
            matrix: block.prepared.matrix,
            columns: used,
            directions: dirs,
          });
          const expected = block.weights[scheme]!;
          expectCloseRecords(
            w.factors,
            expected.factors,
            `${block.id} ${scheme} factors`,
          );
          for (const f of Object.keys(expected.variables_within)) {
            expectCloseRecords(
              w.variablesWithin[f] ?? {},
              expected.variables_within[f]!,
              `${block.id} ${scheme} within ${f}`,
            );
          }
          expectCloseRecords(
            flatWeights(w, used),
            expected.flat,
            `${block.id} ${scheme} flat`,
          );
        });
      }

      for (const [key, expectedScores] of Object.entries(block.scores)) {
        it(`score ${key}`, () => {
          const [scheme, normId, method] = key.split("|") as [
            WeightSchemeId,
            NormalizationId,
            McdmId,
          ];
          const used = block.prepared.used_variables;
          const vars = golden.variables.filter((v) => used.includes(v.id));
          const dirs: Record<string, Direction> = {};
          for (const c of used) dirs[c] = block.directions[c]!;
          let w = getWeights(scheme, vars, {
            matrix: block.prepared.matrix,
            columns: used,
            directions: dirs,
          });
          w = restrictWeights(w, used);
          const normalized = normalizeMatrix(block.prepared.matrix, used, dirs, normId);
          const got = scoreMcdm(
            block.prepared.matrix,
            used,
            w as HierarchicalWeights,
            dirs,
            method,
            { normalized },
          );
          expectCloseArrays(got, expectedScores, `${block.id} ${key}`);
        });
      }
    });
  }
});
