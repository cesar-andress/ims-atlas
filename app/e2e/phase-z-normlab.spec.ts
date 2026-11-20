import { expect, test } from "@playwright/test";
import { encodeConfig, openMoreOptions } from "./_helpers";
import { COL_HS64_PRESET } from "../src/state/schema";

test.describe("Phase Z normalisation lab", () => {
  test("lab view shows pipeline controls and docs why-normalize", async ({ page }) => {
    await page.goto(
      `/norm_lab?c=${encodeConfig({
        ...COL_HS64_PRESET,
        view: "norm_lab",
        labSkew: "none",
        labOutlier: "none",
        labScale: "minmax",
        labCompareScale: "zscore",
        lang: "en",
      })}`,
    );
    await expect(page.getByTestId("norm-lab-view")).toBeVisible({
      timeout: 20_000,
    });
    // Pending release still renders the shell; when a panel exists, body appears.
    const body = page.getByTestId("norm-lab-body");
    const pending = page.getByTestId("data-release-pending");
    await expect(body.or(pending)).toBeVisible({ timeout: 20_000 });
    if (await body.isVisible()) {
      await expect(page.getByTestId("norm-lab-skew")).toHaveValue("none");
      await expect(page.getByTestId("norm-lab-scale-a")).toHaveValue("minmax");
      await expect(page.getByTestId("norm-lab-hist-before")).toBeVisible();
      await expect(page.getByTestId("norm-lab-compare")).toBeVisible();
    }

    await page.goto("/docs");
    await expect(page.getByTestId("docs-why-normalize")).toBeVisible();
    await expect(page.getByTestId("normalization-select")).toHaveCount(0);
  });

  test("config panel offers robust_z", async ({ page }) => {
    await page.goto(
      `/variables?c=${encodeConfig({
        ...COL_HS64_PRESET,
        view: "variables",
        lang: "en",
      })}`,
    );
    await openMoreOptions(page);
    await expect(page.getByTestId("normalization-select")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByTestId("normalization-select").locator('option[value="robust_z"]'),
    ).toHaveCount(1);
  });
});
