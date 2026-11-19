import type { WorkerRequest, WorkerResponse } from "@ims-atlas/core";

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./engineWorker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

export function runEngineWorker(
  request: WorkerRequest,
): Promise<Exclude<WorkerResponse, { type: "error" }>> {
  const id = request.id || `w-${++seq}`;
  const payload: WorkerRequest = { ...request, id } as WorkerRequest;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      if (event.data.type === "error") {
        reject(new Error(event.data.message));
        return;
      }
      resolve(event.data);
    };
    w.addEventListener("message", onMessage);
    w.postMessage(payload);
  });
}
