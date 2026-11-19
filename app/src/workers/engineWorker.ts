/// <reference lib="webworker" />
import { handleWorkerRequest, type WorkerRequest } from "@ims-atlas/core";

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const response = handleWorkerRequest(event.data);
  ctx.postMessage(response);
};
