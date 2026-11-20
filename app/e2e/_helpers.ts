import { expect, type Page } from "@playwright/test";

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

/** Open the collapsed "Más opciones" block on the Variables y pesos step. */
export async function openMoreOptions(page: Page): Promise<void> {
  const more = page.getByTestId("variables-more");
  await expect(more).toBeVisible({ timeout: 15_000 });
  const isOpen = await more.evaluate((el) => (el as HTMLDetailsElement).open);
  if (!isOpen) await more.locator("summary").first().click();
}

/** Open the origin / product / year dialog from a project bar chip. */
export async function openScopeDialog(
  page: Page,
  chip: "origin" | "product" | "year" = "origin",
): Promise<void> {
  await page.getByTestId(`chip-${chip}`).click();
  await expect(page.getByTestId("project-scope-dialog")).toBeVisible();
}
