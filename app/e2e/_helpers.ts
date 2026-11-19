/** Shared permalink encoder for Playwright specs. */
export function encodeConfig(config: object): string {
  return Buffer.from(JSON.stringify(config), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
