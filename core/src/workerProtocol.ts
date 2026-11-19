/**
 * Message protocol for running heavy SMAA / bootstrap loops in a Web Worker.
 * ``core`` stays pure (no DOM); the app posts these messages and applies results.
 */

import type { BlockMetricRow } from "./backtest.js";
import {
  bootstrapMethodSummary,
  bootstrapPairedDeltas,
  type BootstrapSummary,
  type PairedDelta,
} from "./bootstrap.js";
import {
  runSmaaWsm,
  type SamplingMode,
  type SmaaResult,
  type WeightStats,
} from "./smaa.js";

export type SmaaWorkerRequest = {
  type: "smaa_wsm";
  id: string;
  normalized: number[][];
  alternatives: string[];
  columns: string[];
  stats: WeightStats;
  nSamples: number;
  seed: number;
  mode: SamplingMode;
  dispersionScale: number;
};

export type BootstrapPairedWorkerRequest = {
  type: "bootstrap_paired";
  id: string;
  rows: BlockMetricRow[];
  metric: string;
  nReps: number;
  seed: number;
  baselines: string[];
};

export type BootstrapSummaryWorkerRequest = {
  type: "bootstrap_summary";
  id: string;
  rows: BlockMetricRow[];
  metric: string;
  nReps: number;
  seed: number;
};

export type WorkerRequest =
  SmaaWorkerRequest | BootstrapPairedWorkerRequest | BootstrapSummaryWorkerRequest;

export type WorkerResponse =
  | { type: "smaa_wsm"; id: string; result: SmaaResult }
  | { type: "bootstrap_paired"; id: string; result: PairedDelta[] }
  | { type: "bootstrap_summary"; id: string; result: BootstrapSummary[] }
  | { type: "error"; id: string; message: string };

/** Pure handler for a worker ``onmessage`` wrapper in the app. */
export function handleWorkerRequest(req: WorkerRequest): WorkerResponse {
  try {
    if (req.type === "smaa_wsm") {
      const result = runSmaaWsm(
        req.normalized,
        req.alternatives,
        req.columns,
        req.stats,
        {
          nSamples: req.nSamples,
          seed: req.seed,
          mode: req.mode,
          dispersionScale: req.dispersionScale,
        },
      );
      return { type: "smaa_wsm", id: req.id, result };
    }
    if (req.type === "bootstrap_paired") {
      const result = bootstrapPairedDeltas(req.rows, {
        metric: req.metric,
        nReps: req.nReps,
        seed: req.seed,
        baselines: req.baselines,
      });
      return { type: "bootstrap_paired", id: req.id, result };
    }
    if (req.type === "bootstrap_summary") {
      const result = bootstrapMethodSummary(req.rows, {
        metric: req.metric,
        nReps: req.nReps,
        seed: req.seed,
      });
      return { type: "bootstrap_summary", id: req.id, result };
    }
    return {
      type: "error",
      id: (req as WorkerRequest & { id: string }).id,
      message: "unknown request",
    };
  } catch (err) {
    return {
      type: "error",
      id: req.id,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
