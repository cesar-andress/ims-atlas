/**
 * Prompt 4a acceptance against the live host (optional).
 *
 * Requires ATLAS_E2E_BASE_URL (e.g. https://atlas.aiserv.es) and an Authelia
 * session cookie via storageState, or a prior login. Skips when unset.
 *
 * Fails on DuckDB ``IO Error`` / ``No files found`` in the console.
 */
import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./_helpers";

const baseURL = process.env.ATLAS_E2E_BASE_URL?.replace(/\/$/, "");

test.describe("ESP · café · 2024 live panel", () => {
  test.skip(!baseURL, "Set ATLAS_E2E_BASE_URL to run against the live host");

  test("new project loads ranking without parquet IO errors", async ({ page }) => {
    const ioErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (/IO Error|No files found/i.test(text)) ioErrors.push(text);
    });
    page.on("pageerror", (err) => {
      if (/IO Error|No files found/i.test(err.message)) {
        ioErrors.push(err.message);
      }
    });

    await skipOnboarding(page);
    await page.goto(baseURL!, { waitUntil: "networkidle" });

    const newBtn = page.getByRole("button", {
      name: /nuevo proyecto|new project/i,
    });
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click();
    }

    const origin = page.getByTestId("chip-origin");
    if (await origin.isVisible().catch(() => false)) {
      await origin.click();
      await page
        .getByRole("option", { name: /españa|spain|ESP/i })
        .first()
        .click();
    }
    const product = page.getByTestId("chip-product");
    if (await product.isVisible().catch(() => false)) {
      await product.click();
      await page
        .getByText(/café|coffee|0901/i)
        .first()
        .click();
    }
    const year = page.getByTestId("chip-year");
    if (await year.isVisible().catch(() => false)) {
      await year.click();
      await page.getByRole("option", { name: "2024" }).first().click();
    }

    await page.waitForTimeout(8_000);
    expect(ioErrors, `console IO errors: ${ioErrors.join(" | ")}`).toEqual([]);
  });
});
