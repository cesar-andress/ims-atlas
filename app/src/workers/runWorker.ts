import type { MarketLayoutResult } from "@ims-atlas/core";

type LayoutRequest = {
  type: "market_layout";
  id: string;
  candidates: string[];
  normalized: number[][];
  ranking: { iso3: string; score: number; rank: number }[];
  k: number;
  seed: number;
};

type LayoutResponse =
  | { type: "market_layout"; id: string; result: MarketLayoutResult }
  | { type: "error"; id: string; message: string };

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./layoutWorker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

export function runMarketLayoutWorker(
  request: Omit<LayoutRequest, "id"> & { id?: string },
): Promise<MarketLayoutResult> {
  const id = request.id ?? `w-${++seq}`;
  const payload: LayoutRequest = { ...request, id };
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<LayoutResponse>) => {
      if (event.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      if (event.data.type === "error") {
        reject(new Error(event.data.message));
        return;
      }
      resolve(event.data.result);
    };
    w.addEventListener("message", onMessage);
    w.postMessage(payload);
  });
}

/** @deprecated Use runMarketLayoutWorker — kept for call-site clarity. */
export const runEngineWorker = runMarketLayoutWorker;
