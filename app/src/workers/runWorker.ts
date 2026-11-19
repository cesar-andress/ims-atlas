import type {
  BootstrapSummary,
  MarketLayoutResult,
  PairedDelta,
  SmaaResult,
  WorkerRequest,
  WorkerResponse,
} from "@ims-atlas/core";

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

function postAndWait<R>(payload: WorkerRequest): Promise<R> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== payload.id) return;
      w.removeEventListener("message", onMessage);
      if (event.data.type === "error") {
        reject(new Error(event.data.message));
        return;
      }
      if (event.data.type !== payload.type) {
        reject(new Error(`unexpected worker response ${event.data.type}`));
        return;
      }
      resolve((event.data as unknown as { result: R }).result);
    };
    w.addEventListener("message", onMessage);
    w.postMessage(payload);
  });
}

export function runMarketLayoutWorker(
  request: Omit<Extract<WorkerRequest, { type: "market_layout" }>, "id"> & {
    id?: string;
  },
): Promise<MarketLayoutResult> {
  const id = request.id ?? `w-${++seq}`;
  return postAndWait({ ...request, id, type: "market_layout" });
}

export function runSmaaWorker(
  request: Omit<Extract<WorkerRequest, { type: "smaa_wsm" }>, "id"> & { id?: string },
): Promise<SmaaResult> {
  const id = request.id ?? `w-${++seq}`;
  return postAndWait({ ...request, id, type: "smaa_wsm" });
}

export function runBootstrapPairedWorker(
  request: Omit<Extract<WorkerRequest, { type: "bootstrap_paired" }>, "id"> & {
    id?: string;
  },
): Promise<PairedDelta[]> {
  const id = request.id ?? `w-${++seq}`;
  return postAndWait({ ...request, id, type: "bootstrap_paired" });
}

export function runBootstrapSummaryWorker(
  request: Omit<Extract<WorkerRequest, { type: "bootstrap_summary" }>, "id"> & {
    id?: string;
  },
): Promise<BootstrapSummary[]> {
  const id = request.id ?? `w-${++seq}`;
  return postAndWait({ ...request, id, type: "bootstrap_summary" });
}

/** @deprecated Prefer typed helpers. */
export const runEngineWorker = runMarketLayoutWorker;
