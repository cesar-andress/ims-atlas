/// <reference lib="webworker" />
/**
 * Slim worker: only SMACOF + k-means (subpath import avoids core barrel).
 */
import { buildMarketLayout } from "@ims-atlas/core/marketLayout";

type LayoutRequest = {
  type: "market_layout";
  id: string;
  candidates: string[];
  normalized: number[][];
  ranking: { iso3: string; score: number; rank: number }[];
  k: number;
  seed: number;
};

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const req = event.data;
  try {
    if (req.type !== "market_layout") {
      ctx.postMessage({ type: "error", id: req.id, message: "unknown request" });
      return;
    }
    const result = buildMarketLayout({
      candidates: req.candidates,
      normalized: req.normalized,
      ranking: req.ranking,
      k: req.k,
      seed: req.seed,
    });
    ctx.postMessage({ type: "market_layout", id: req.id, result });
  } catch (err) {
    ctx.postMessage({
      type: "error",
      id: req.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
