/// <reference lib="webworker" />
/**
 * Engine worker: SMAA, bootstrap, and market layout via core.handleWorkerRequest.
 */
import { handleWorkerRequest, type WorkerRequest } from "@ims-atlas/core";

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const response = handleWorkerRequest(event.data);
  ctx.postMessage(response);
};
