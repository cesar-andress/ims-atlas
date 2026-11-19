/** Route the product demo URL to the private synthetic COL/HS64 panel (e2e only). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
export const SYNTHETIC_COL_HS64_FULL = readFileSync(
  join(here, "fixtures/synthetic_col_hs64_full.json"),
  "utf8",
);

export async function routeSyntheticDemoPanel(page: Page): Promise<void> {
  await page.route("**/meta/col_hs64_demo.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: SYNTHETIC_COL_HS64_FULL,
    });
  });
}
