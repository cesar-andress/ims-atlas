import { expect, test } from "@playwright/test";
import { encodeConfig, skipOnboarding } from "./_helpers";

const VIEWS = [
  { path: "/", view: "home", testId: "home-view" },
  { path: "/datos", view: "datos", testId: "datos-hub" },
  { path: "/variables", view: "variables", testId: "variables-hub" },
  { path: "/analisis", view: "analisis", testId: "results-shell" },
  { path: "/status", view: "status", testId: "data-status-view" },
  { path: "/docs", view: "docs", testId: "docs-view" },
] as const;

const SIZES = [
  { w: 1440, h: 900, tag: "1440" },
  { w: 390, h: 844, tag: "390" },
] as const;

/**
 * Full view × theme × viewport matrix. Pixel baselines are updated with
 * `pnpm --filter @ims-atlas/app exec playwright test e2e/visual-matrix.spec.ts --update-snapshots`.
 */
test.describe("Visual regression matrix", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const size of SIZES) {
      for (const v of VIEWS) {
        test(`${v.view} · ${theme} · ${size.tag}`, async ({ page }) => {
          await skipOnboarding(page);
          await page.setViewportSize({ width: size.w, height: size.h });
          await page.addInitScript((th) => {
            document.documentElement.setAttribute("data-theme", th);
            localStorage.setItem("ims-atlas.theme", th);
          }, theme);
          await page.goto(
            `${v.path}?c=${encodeConfig({ v: 1, view: v.view, lang: "en" })}`,
          );
          await page.evaluate((th) => {
            document.documentElement.setAttribute("data-theme", th);
          }, theme);
          await expect(page.getByTestId(v.testId)).toBeVisible({ timeout: 20_000 });
          await expect(page.locator("main")).toHaveScreenshot(
            `${v.view}-${theme}-${size.tag}.png`,
            { maxDiffPixelRatio: 0.06 },
          );
        });
      }
    }
  }
});
