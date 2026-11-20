import { expect, test } from "@playwright/test";
import { encodeConfig } from "./_helpers";
import { routeSyntheticDemoPanel } from "./_syntheticPanel";

const COL = {
  v: 1 as const,
  origin: "COL",
  hs: "64",
  year: 2023,
  lang: "en" as const,
  normalization: "minmax" as const,
  mcdm: "wsm" as const,
  weightScheme: "expert_mean" as const,
  missingThreshold: 0.2,
};

const RESULT_PATHS = [
  "/ranking",
  "/matrix",
  "/map",
  "/uncertainty",
  "/compare",
  "/time",
  "/backtest",
  "/factors",
] as const;

test.describe("Result screens: 0 editable inputs (GUI simplicity)", () => {
  test.beforeEach(async ({ page }) => {
    await routeSyntheticDemoPanel(page);
  });

  for (const path of RESULT_PATHS) {
    test(`${path}: no input/select/textarea in main`, async ({ page }) => {
      await page.goto(
        `${path}?c=${encodeConfig({ ...COL, view: path.slice(1) as "ranking" })}`,
      );
      await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
      // Side config must never appear on results.
      await expect(page.getByTestId("config-panel")).toHaveCount(0);
      const n = await page.locator("main").locator("input, select, textarea").count();
      expect(n, `${path} still has editable controls`).toBe(0);
    });
  }
});
