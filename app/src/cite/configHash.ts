/** Deterministic SHA-256 hex of canonical analysis config JSON. */

function canonicalConfig(config: object): string {
  const keys = Object.keys(config).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) {
    const v = (config as Record<string, unknown>)[k];
    if (v === undefined) continue;
    sorted[k] = v;
  }
  return JSON.stringify(sorted);
}

export async function hashConfig(config: object): Promise<string> {
  const data = new TextEncoder().encode(canonicalConfig(config));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
