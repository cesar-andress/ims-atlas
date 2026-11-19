/** Run work when the browser is idle (fallback: short timeout). */
export function scheduleIdle(fn: () => void, timeoutMs = 2500): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => fn(), { timeout: timeoutMs });
    return;
  }
  setTimeout(fn, Math.min(timeoutMs, 200));
}
