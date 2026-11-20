/** Shared permalink encoder for Playwright specs. */
export function encodeConfig(config: object): string {
  return Buffer.from(JSON.stringify(config), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Skip first-visit onboarding overlay in e2e unless a test opts in. */
export async function skipOnboarding(page: {
  addInitScript: (fn: () => void) => Promise<void>;
}): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("ims-atlas.onboarding.done", "1");
  });
}

/** Show full Variables ConfigPanel (all guided steps). */
export async function enableVariablesExpert(page: {
  addInitScript: (fn: () => void) => Promise<void>;
}): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("ims-atlas.variables.expert", "1");
  });
}
